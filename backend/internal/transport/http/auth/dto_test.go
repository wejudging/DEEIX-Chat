package auth

import (
	"testing"

	"github.com/DEEIX-AI/DEEIX-Chat/backend/internal/application/userview"
)

func TestToUserResponseIncludesBillingAccount(t *testing.T) {
	response := toUserResponse(userview.UserView{
		BillingAccountCurrency: "USD",
		BillingBalanceNanousd:  9_052_987_000,
		BillingAccountStatus:   "active",
	})

	if response.BillingAccountCurrency != "USD" {
		t.Fatalf("expected billing currency USD, got %q", response.BillingAccountCurrency)
	}
	if response.BillingBalanceNanousd != 9_052_987_000 {
		t.Fatalf("expected nanousd balance to be preserved, got %d", response.BillingBalanceNanousd)
	}
	if response.BillingBalanceUSD != 9.052987 {
		t.Fatalf("expected USD balance 9.052987, got %f", response.BillingBalanceUSD)
	}
	if response.BillingAccountStatus != "active" {
		t.Fatalf("expected billing account status active, got %q", response.BillingAccountStatus)
	}
}
