package billing

import (
	"testing"
	"time"
)

// shanghaiTime 构造用于时段判定的本地时刻，避免测试依赖运行机器时区。
func shanghaiTime(t *testing.T, value string) time.Time {
	t.Helper()
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.FixedZone("CST", 8*60*60)
	}
	parsed, err := time.ParseInLocation("2006-01-02 15:04", value, location)
	if err != nil {
		t.Fatalf("parse %s: %v", value, err)
	}
	return parsed
}

const peakValleyPricingJSON = `{
	"timezone": "Asia/Shanghai",
	"periods": [
		{"label": "高峰时段", "multiplier": 1, "weekdays": [1, 2, 3, 4, 5], "windows": [["09:00", "12:00"], ["14:00", "18:00"]]},
		{"label": "空闲时段", "multiplier": 0.5}
	]
}`

func TestParseTimePricingConfigRejectsUnknownFields(t *testing.T) {
	if _, err := parseTimePricingConfig(`{"periods": [{"label": "x", "multiplier": 1, "fromHour": 9}]}`); err == nil {
		t.Fatal("unknown field should be rejected")
	}
}

func TestParseTimePricingConfigRejectsInvalidValues(t *testing.T) {
	cases := map[string]string{
		"zero multiplier":     `{"periods": [{"multiplier": 0}]}`,
		"negative multiplier": `{"periods": [{"multiplier": -1}]}`,
		"oversized window":    `{"periods": [{"multiplier": 1, "windows": [["09:00", "09:00"]]}]}`,
		"reversed window":     `{"periods": [{"multiplier": 1, "windows": [["18:00", "09:00"]]}]}`,
		"bad clock":           `{"periods": [{"multiplier": 1, "windows": [["9", "12:00"]]}]}`,
		"weekday overflow":    `{"periods": [{"multiplier": 1, "weekdays": [7]}]}`,
		"unknown timezone":    `{"timezone": "Mars/Olympus", "periods": [{"multiplier": 1}]}`,
		"bad month":           `{"campaigns": [{"multiplier": 1, "month": 13}]}`,
		"reversed day range":  `{"campaigns": [{"multiplier": 1, "fromDay": 20, "beforeDay": 10}]}`,
		"bad start date":      `{"campaigns": [{"multiplier": 1, "startDate": "2026/09/01"}]}`,
		"bad end date":        `{"campaigns": [{"multiplier": 1, "endDate": "2026-13-01"}]}`,
		"reversed date range": `{"campaigns": [{"multiplier": 1, "startDate": "2026-09-21", "endDate": "2026-09-01"}]}`,
		"malformed json":      `{"periods": [`,
	}
	for name, raw := range cases {
		if _, err := parseTimePricingConfig(raw); err == nil {
			t.Fatalf("%s should be rejected", name)
		}
	}
}

func TestNormalizeTimePricingJSONFallsBackToEmptyObject(t *testing.T) {
	for _, raw := range []string{"", "  ", "{}", `{"timezone":"Asia/Shanghai"}`} {
		normalized, err := normalizeTimePricingJSON(raw)
		if err != nil {
			t.Fatalf("normalize %q: %v", raw, err)
		}
		if normalized != "{}" {
			t.Fatalf("normalize %q = %s, want {}", raw, normalized)
		}
	}
}

func TestNormalizeTimePricingJSONKeepsConfiguredTimezone(t *testing.T) {
	normalized, err := normalizeTimePricingJSON(`{"periods":[{"label":"高峰时段","multiplier":1,"windows":[["09:00","12:00"]]}]}`)
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	config, err := parseTimePricingConfig(normalized)
	if err != nil {
		t.Fatalf("reparse: %v", err)
	}
	if config.Timezone != defaultTimePricingTimezone {
		t.Fatalf("timezone = %q, want %q", config.Timezone, defaultTimePricingTimezone)
	}
}

func TestResolveTimePricingMultiplierMatchesPeakAndIdleWindows(t *testing.T) {
	config, err := parseTimePricingConfig(peakValleyPricingJSON)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	cases := []struct {
		at         string
		multiplier float64
		label      string
	}{
		{at: "2026-09-16 09:30", multiplier: 1, label: "高峰时段"},
		{at: "2026-09-16 11:59", multiplier: 1, label: "高峰时段"},
		{at: "2026-09-16 12:00", multiplier: 0.5, label: "空闲时段"},
		{at: "2026-09-16 14:00", multiplier: 1, label: "高峰时段"},
		{at: "2026-09-16 18:00", multiplier: 0.5, label: "空闲时段"},
		{at: "2026-09-16 23:30", multiplier: 0.5, label: "空闲时段"},
		{at: "2026-09-19 10:00", multiplier: 0.5, label: "空闲时段"},
	}
	for _, item := range cases {
		multiplier, label := resolveTimePricingMultiplier(config, shanghaiTime(t, item.at))
		if got := billingRateMultiplierValue(multiplier); got != item.multiplier {
			t.Fatalf("%s multiplier = %v, want %v", item.at, got, item.multiplier)
		}
		if label != item.label {
			t.Fatalf("%s label = %q, want %q", item.at, label, item.label)
		}
	}
}

func TestResolveTimePricingMultiplierKeepsIdentityWithoutConfiguration(t *testing.T) {
	config, err := parseTimePricingConfig("")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	multiplier, label := resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-16 10:00"))
	if multiplier.Numerator != 1 || multiplier.Denominator != 1 {
		t.Fatalf("multiplier = %d/%d, want 1/1", multiplier.Numerator, multiplier.Denominator)
	}
	if label != "" {
		t.Fatalf("label = %q, want empty", label)
	}
}

func TestResolveTimePricingMultiplierStacksCampaignsOnPeriod(t *testing.T) {
	config, err := parseTimePricingConfig(`{
		"periods": [
			{"label": "高峰时段", "multiplier": 1, "weekdays": [1,2,3,4,5], "windows": [["09:00", "12:00"]]},
			{"label": "空闲时段", "multiplier": 0.5}
		],
		"campaigns": [
			{"label": "限时5折", "multiplier": 0.5, "month": 9, "beforeDay": 21},
			{"label": "新用户体验", "multiplier": 0.5, "month": 9, "beforeDay": 10}
		]
	}`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}

	// 9 月 16 日 10:00：高峰 1 x 限时 0.5 = 0.5。
	multiplier, label := resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-16 10:00"))
	if got := billingRateMultiplierValue(multiplier); got != 0.5 {
		t.Fatalf("multiplier = %v, want 0.5", got)
	}
	if label != "高峰时段 · 限时5折" {
		t.Fatalf("label = %q", label)
	}

	// 9 月 20 日 23:00：空闲 0.5 x 限时 0.5 = 0.25，活动在 21 日开始失效。
	multiplier, _ = resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-20 23:00"))
	if got := billingRateMultiplierValue(multiplier); got != 0.25 {
		t.Fatalf("multiplier = %v, want 0.25", got)
	}
	multiplier, _ = resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-21 23:00"))
	if got := billingRateMultiplierValue(multiplier); got != 0.5 {
		t.Fatalf("multiplier after campaign = %v, want 0.5", got)
	}

	// 9 月 8 日（周二）10:00：高峰 1 x 限时 0.5 x 新用户 0.5 = 0.25。
	multiplier, _ = resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-08 10:00"))
	if got := billingRateMultiplierValue(multiplier); got != 0.25 {
		t.Fatalf("multiplier = %v, want 0.25", got)
	}
}

func TestResolveTimePricingMultiplierExpiresOneOffCampaign(t *testing.T) {
	config, err := parseTimePricingConfig(`{
		"campaigns": [
			{"label": "限时5折", "multiplier": 0.5, "startDate": "2026-09-01", "endDate": "2026-09-20"}
		]
	}`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}

	cases := []struct {
		at         string
		multiplier float64
	}{
		{at: "2026-08-31 23:59", multiplier: 1},
		{at: "2026-09-01 00:00", multiplier: 0.5},
		{at: "2026-09-20 23:59", multiplier: 0.5},
		// 结束日含当天：跨过 9 月 20 日 24 点后立刻失效。
		{at: "2026-09-21 00:00", multiplier: 1},
		// 明年 9 月不再自动恢复一次性档期。
		{at: "2027-09-16 10:00", multiplier: 1},
	}
	for _, item := range cases {
		multiplier, _ := resolveTimePricingMultiplier(config, shanghaiTime(t, item.at))
		if got := billingRateMultiplierValue(multiplier); got != item.multiplier {
			t.Fatalf("%s multiplier = %v, want %v", item.at, got, item.multiplier)
		}
	}
}

func TestNormalizeTimePricingJSONRoundTripsCampaignDates(t *testing.T) {
	normalized, err := normalizeTimePricingJSON(`{
		"campaigns": [{"label": "限时5折", "multiplier": 0.5, "startDate": "2026-09-01", "endDate": "2026-09-20"}]
	}`)
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	config, err := parseTimePricingConfig(normalized)
	if err != nil {
		t.Fatalf("reparse: %v", err)
	}
	if len(config.Campaigns) != 1 || config.Campaigns[0].StartDate != "2026-09-01" || config.Campaigns[0].EndDate != "2026-09-20" {
		t.Fatalf("campaign round trip = %+v", config.Campaigns)
	}
}

func TestResolveTimePricingMultiplierUsesConfiguredTimezone(t *testing.T) {
	config, err := parseTimePricingConfig(`{
		"timezone": "UTC",
		"periods": [
			{"label": "高峰时段", "multiplier": 1, "windows": [["01:00", "02:00"]]},
			{"label": "空闲时段", "multiplier": 0.5}
		]
	}`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	// 上海 09:30 == UTC 01:30。
	multiplier, label := resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-16 09:30"))
	if label != "高峰时段" {
		t.Fatalf("label = %q, want 高峰时段", label)
	}
	// 上海 03:00 == UTC 前一日 19:00。
	multiplier, label = resolveTimePricingMultiplier(config, shanghaiTime(t, "2026-09-16 03:00"))
	if label != "空闲时段" {
		t.Fatalf("label = %q, want 空闲时段", label)
	}
	if got := billingRateMultiplierValue(multiplier); got != 0.5 {
		t.Fatalf("multiplier = %v, want 0.5", got)
	}
}

func TestComposeTimeRateMultiplierReducesFraction(t *testing.T) {
	combined := composeTimeRateMultiplier(
		billingRateMultiplier{Numerator: 1, Denominator: 1},
		billingRateMultiplier{Numerator: 500000, Denominator: 1000000},
	)
	if combined.Numerator != 1 || combined.Denominator != 2 {
		t.Fatalf("combined = %d/%d, want 1/2", combined.Numerator, combined.Denominator)
	}

	stacked := composeTimeRateMultiplier(combined, billingRateMultiplier{Numerator: 1, Denominator: 2})
	if stacked.Numerator != 1 || stacked.Denominator != 4 {
		t.Fatalf("stacked = %d/%d, want 1/4", stacked.Numerator, stacked.Denominator)
	}

	// 折扣叠加后仍作用在既有分组倍率之上。
	withGroup := composeTimeRateMultiplier(billingRateMultiplier{Numerator: 9, Denominator: 10}, stacked)
	if withGroup.Numerator != 9 || withGroup.Denominator != 40 {
		t.Fatalf("with group = %d/%d, want 9/40", withGroup.Numerator, withGroup.Denominator)
	}
}

func TestComposeTimeRateMultiplierHandlesOverflowGuard(t *testing.T) {
	// 极端倍率相乘后仍应还原成可比较的数值，而不是整数溢出。
	half := billingRateMultiplier{Numerator: 1, Denominator: 2}
	combined := composeTimeRateMultiplier(
		billingRateMultiplier{Numerator: 1 << 32, Denominator: 1},
		half,
	)
	if got := billingRateMultiplierValue(combined); got != float64(1<<31) {
		t.Fatalf("multiplier = %v, want %v", got, float64(1<<31))
	}
}

func TestApplyRateMultiplierRoundsHalfAwayFromZero(t *testing.T) {
	rate := int64(1000000000)
	if got := applyRateMultiplier(rate, billingRateMultiplier{Numerator: 1, Denominator: 2}); got != 500000000 {
		t.Fatalf("half rate = %d, want 500000000", got)
	}
	if got := applyRateMultiplier(rate, billingRateMultiplier{Numerator: 1, Denominator: 4}); got != 250000000 {
		t.Fatalf("quarter rate = %d, want 250000000", got)
	}
	if got := applyRateMultiplier(rate, billingRateMultiplier{Numerator: 3, Denominator: 2}); got != 1500000000 {
		t.Fatalf("surge rate = %d, want 1500000000", got)
	}
}

func TestBillingRateMultiplierFromFloatRejectsInvalidValues(t *testing.T) {
	identity := billingRateMultiplier{Numerator: 1, Denominator: 1}
	for _, value := range []float64{0, -1, 1001} {
		if got := billingRateMultiplierFromFloat(value); got != identity {
			t.Fatalf("billingRateMultiplierFromFloat(%v) = %+v, want identity", value, got)
		}
	}
	if got := billingRateMultiplierFromFloat(0.28); got.Numerator != 7 || got.Denominator != 25 {
		t.Fatalf("0.28 => %d/%d, want 7/25", got.Numerator, got.Denominator)
	}
}
