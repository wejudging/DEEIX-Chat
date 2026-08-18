package conversation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	appconversation "github.com/DEEIX-AI/DEEIX-Chat/backend/internal/application/conversation"
	"github.com/DEEIX-AI/DEEIX-Chat/backend/internal/infra/cache/memory"
	"github.com/DEEIX-AI/DEEIX-Chat/backend/internal/infra/config"
	"github.com/DEEIX-AI/DEEIX-Chat/backend/internal/repository"
	"github.com/DEEIX-AI/DEEIX-Chat/backend/internal/transport/http/middleware"
	"github.com/gin-gonic/gin"
)

type testNDJSONResponseWriter struct {
	body             bytes.Buffer
	mu               sync.Mutex
	activeOperations atomic.Int32
	concurrentAccess atomic.Bool
	writes           atomic.Int32
	failWrites       bool
	written          chan []byte
	writeStarted     chan struct{}
	releaseWrite     chan struct{}
}

func (w *testNDJSONResponseWriter) beginOperation() func() {
	if w.activeOperations.Add(1) != 1 {
		w.concurrentAccess.Store(true)
	}
	return func() {
		w.activeOperations.Add(-1)
	}
}

func (w *testNDJSONResponseWriter) Write(payload []byte) (int, error) {
	done := w.beginOperation()
	defer done()
	time.Sleep(100 * time.Microsecond)
	w.writes.Add(1)
	if w.writeStarted != nil {
		w.writeStarted <- struct{}{}
	}
	if w.releaseWrite != nil {
		<-w.releaseWrite
	}
	if w.failWrites {
		return 0, errors.New("client disconnected")
	}
	copyOfPayload := append([]byte(nil), payload...)
	w.mu.Lock()
	written, err := w.body.Write(copyOfPayload)
	w.mu.Unlock()
	if w.written != nil {
		w.written <- copyOfPayload
	}
	return written, err
}

func (w *testNDJSONResponseWriter) Flush() {
	done := w.beginOperation()
	defer done()
	time.Sleep(100 * time.Microsecond)
}

func (w *testNDJSONResponseWriter) bytes() []byte {
	w.mu.Lock()
	defer w.mu.Unlock()
	return append([]byte(nil), w.body.Bytes()...)
}

type testStreamingHTTPWriter struct {
	header http.Header
	body   bytes.Buffer
	mu     sync.Mutex
	writes chan []byte
}

func newTestStreamingHTTPWriter() *testStreamingHTTPWriter {
	return &testStreamingHTTPWriter{
		header: make(http.Header),
		writes: make(chan []byte, 16),
	}
}

func (w *testStreamingHTTPWriter) Header() http.Header {
	return w.header
}

func (w *testStreamingHTTPWriter) WriteHeader(_ int) {}

func (w *testStreamingHTTPWriter) Write(payload []byte) (int, error) {
	copyOfPayload := append([]byte(nil), payload...)
	w.mu.Lock()
	written, err := w.body.Write(copyOfPayload)
	w.mu.Unlock()
	select {
	case w.writes <- copyOfPayload:
	default:
	}
	return written, err
}

func (w *testStreamingHTTPWriter) Flush() {}

func (w *testStreamingHTTPWriter) bytes() []byte {
	w.mu.Lock()
	defer w.mu.Unlock()
	return append([]byte(nil), w.body.Bytes()...)
}

func TestStreamNDJSONWriterSerializesConcurrentEvents(t *testing.T) {
	responseWriter := &testNDJSONResponseWriter{}
	streamWriter := newStreamNDJSONWriter(responseWriter)

	const eventCount = 40
	var eventWG sync.WaitGroup
	errCh := make(chan error, eventCount)
	for index := 0; index < eventCount; index++ {
		eventWG.Add(1)
		go func(index int) {
			defer eventWG.Done()
			eventType := "heartbeat"
			payload := map[string]interface{}{"type": eventType}
			if index%2 == 0 {
				payload = map[string]interface{}{"type": "delta", "delta": strconv.Itoa(index)}
			}
			errCh <- streamWriter.write(payload)
		}(index)
	}
	eventWG.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			t.Fatalf("write event: %v", err)
		}
	}

	if responseWriter.concurrentAccess.Load() {
		t.Fatal("response writer was accessed concurrently")
	}
	lines := bytes.Split(bytes.TrimSpace(responseWriter.bytes()), []byte{'\n'})
	if len(lines) != eventCount {
		t.Fatalf("event lines = %d, want %d", len(lines), eventCount)
	}
	for _, line := range lines {
		var payload map[string]interface{}
		if err := json.Unmarshal(line, &payload); err != nil {
			t.Fatalf("invalid NDJSON line %q: %v", line, err)
		}
	}
}

func TestStreamNDJSONHeartbeatIsPeriodicAndStops(t *testing.T) {
	responseWriter := &testNDJSONResponseWriter{written: make(chan []byte, 8)}
	streamWriter := newStreamNDJSONWriter(responseWriter)
	stopHeartbeat := streamWriter.startHeartbeat(5 * time.Millisecond)

	select {
	case payload := <-responseWriter.written:
		if got, want := string(payload), "{\"type\":\"heartbeat\"}\n"; got != want {
			t.Fatalf("heartbeat = %q, want %q", got, want)
		}
	case <-time.After(time.Second):
		t.Fatal("heartbeat was not written")
	}

	stopHeartbeat()
	writesAfterStop := responseWriter.writes.Load()
	time.Sleep(20 * time.Millisecond)
	if got := responseWriter.writes.Load(); got != writesAfterStop {
		t.Fatalf("writes continued after heartbeat stopped: got %d, want %d", got, writesAfterStop)
	}
	stopHeartbeat()
}

func TestStreamNDJSONHeartbeatStopWaitsForWriter(t *testing.T) {
	responseWriter := &testNDJSONResponseWriter{
		writeStarted: make(chan struct{}, 1),
		releaseWrite: make(chan struct{}),
	}
	streamWriter := newStreamNDJSONWriter(responseWriter)
	stopHeartbeat := streamWriter.startHeartbeat(time.Millisecond)

	select {
	case <-responseWriter.writeStarted:
	case <-time.After(time.Second):
		t.Fatal("heartbeat write did not start")
	}

	stopped := make(chan struct{})
	go func() {
		stopHeartbeat()
		close(stopped)
	}()
	select {
	case <-stopped:
		t.Fatal("heartbeat stop returned before the active write completed")
	case <-time.After(10 * time.Millisecond):
	}

	close(responseWriter.releaseWrite)
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("heartbeat stop did not wait for the active write to complete")
	}
}

func TestStreamNDJSONHeartbeatBypassesGenerationPublisher(t *testing.T) {
	responseWriter := &testNDJSONResponseWriter{}
	streamWriter := newStreamNDJSONWriter(responseWriter)
	var publishCalls atomic.Int32
	publish := func(payload map[string]interface{}) map[string]interface{} {
		publishCalls.Add(1)
		payload["seq"] = 1
		return payload
	}

	if err := streamWriter.publishAndWrite(map[string]interface{}{"type": "delta", "delta": "hello"}, publish); err != nil {
		t.Fatalf("publish event: %v", err)
	}
	if err := streamWriter.write(map[string]interface{}{"type": "heartbeat"}); err != nil {
		t.Fatalf("write heartbeat: %v", err)
	}
	if got := publishCalls.Load(); got != 1 {
		t.Fatalf("publisher calls = %d, want 1", got)
	}

	lines := bytes.Split(bytes.TrimSpace(responseWriter.bytes()), []byte{'\n'})
	if len(lines) != 2 {
		t.Fatalf("event lines = %d, want 2", len(lines))
	}
	var heartbeat map[string]interface{}
	if err := json.Unmarshal(lines[1], &heartbeat); err != nil {
		t.Fatalf("decode heartbeat: %v", err)
	}
	if _, ok := heartbeat["seq"]; ok {
		t.Fatalf("heartbeat unexpectedly contains sequence: %#v", heartbeat)
	}
}

func TestStreamNDJSONPublisherContinuesAfterClientDisconnect(t *testing.T) {
	responseWriter := &testNDJSONResponseWriter{failWrites: true}
	streamWriter := newStreamNDJSONWriter(responseWriter)
	var publishCalls atomic.Int32
	publish := func(payload map[string]interface{}) map[string]interface{} {
		publishCalls.Add(1)
		return payload
	}

	_ = streamWriter.publishAndWrite(map[string]interface{}{"type": "delta", "delta": "first"}, publish)
	_ = streamWriter.publishAndWrite(map[string]interface{}{"type": "delta", "delta": "second"}, publish)

	if got := publishCalls.Load(); got != 2 {
		t.Fatalf("publisher calls after disconnect = %d, want 2", got)
	}
	if got := responseWriter.writes.Load(); got != 1 {
		t.Fatalf("socket writes after disconnect = %d, want 1", got)
	}
}

func TestResumeMessageGenerationStreamWritesHeartbeatWhileWaiting(t *testing.T) {
	previousHeartbeatInterval := messageStreamHeartbeatInterval
	messageStreamHeartbeatInterval = 5 * time.Millisecond
	defer func() {
		messageStreamHeartbeatInterval = previousHeartbeatInterval
	}()

	cache := memory.New()
	service := appconversation.NewService(
		config.Config{},
		nil,
		memory.NewConversationCache(cache),
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	)
	const (
		runID  = "run_resume_heartbeat"
		userID = uint(17)
	)
	if err := cache.RegisterGenerationStream(context.Background(), runID, userID, time.Minute); err != nil {
		t.Fatalf("register generation stream: %v", err)
	}
	if err := cache.TouchGenerationStreamActive(context.Background(), runID, time.Minute); err != nil {
		t.Fatalf("activate generation stream: %v", err)
	}

	gin.SetMode(gin.TestMode)
	responseWriter := newTestStreamingHTTPWriter()
	c, _ := gin.CreateTestContext(responseWriter)
	requestCtx, cancelRequest := context.WithCancel(context.Background())
	c.Request = httptest.NewRequest(http.MethodGet, "/conversation-runs/"+runID+"/stream", nil).WithContext(requestCtx)
	c.Params = gin.Params{{Key: "run_id", Value: runID}}
	c.Set(middleware.ContextKeyUserID, userID)

	handlerDone := make(chan struct{})
	defer func() {
		cancelRequest()
		select {
		case <-handlerDone:
		case <-time.After(time.Second):
			t.Error("resume stream handler did not stop during cleanup")
		}
	}()
	go func() {
		defer close(handlerDone)
		(&Handler{service: service}).ResumeMessageGenerationStream(c)
	}()

	select {
	case payload := <-responseWriter.writes:
		var heartbeat map[string]interface{}
		if err := json.Unmarshal(bytes.TrimSpace(payload), &heartbeat); err != nil {
			t.Fatalf("decode resume heartbeat: %v", err)
		}
		if heartbeat["type"] != "heartbeat" {
			t.Fatalf("first resume event = %#v, want heartbeat", heartbeat)
		}
		if _, ok := heartbeat["seq"]; ok {
			t.Fatalf("resume heartbeat unexpectedly contains sequence: %#v", heartbeat)
		}
	case <-time.After(time.Second):
		t.Fatal("resume stream did not write heartbeat while waiting")
	}

	terminalPayload := `{"type":"completed","data":{}}`
	if _, err := cache.AppendGenerationStreamEvent(context.Background(), runID, repository.GenerationStreamAppend{PayloadJSON: terminalPayload}, 16, time.Minute); err != nil {
		t.Fatalf("append terminal generation event: %v", err)
	}
	select {
	case <-handlerDone:
	case <-time.After(time.Second):
		t.Fatal("resume stream did not finish after terminal event")
	}

	var terminalFound bool
	for _, line := range bytes.Split(bytes.TrimSpace(responseWriter.bytes()), []byte{'\n'}) {
		var payload map[string]interface{}
		if err := json.Unmarshal(line, &payload); err != nil {
			t.Fatalf("invalid resume NDJSON line %q: %v", line, err)
		}
		if payload["type"] == "completed" {
			terminalFound = true
		}
	}
	if !terminalFound {
		t.Fatal("resume stream did not write terminal event")
	}
}
