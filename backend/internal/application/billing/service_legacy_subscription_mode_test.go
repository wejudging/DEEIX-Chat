package billing

import (
	"testing"
	"time"

	domainbilling "github.com/DEEIX-AI/DEEIX-Chat/backend/internal/domain/billing"
)

// HOHAI 定制：站点全局切换为按量计费(usage)后，存量周期订阅用户必须继续按 period 结算，
// 否则他们已购买的套餐额度会被忽略并被“余额不足”拦住；未持订阅的用户仍按按量计费。
func TestResolveEffectiveBillingModeKeepsLegacyPeriodSubscribers(t *testing.T) {
	now := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	startAt := now.AddDate(0, -1, 0)
	endAt := now.AddDate(0, 1, 0)
	expiredAt := now.AddDate(0, -1, 0)

	plans := []domainbilling.Plan{
		{ID: 1, Code: "free", Name: "Free", IsActive: true},
		{ID: 2, Code: "pro", Name: "Pro", IsActive: true, PeriodCreditNanousd: 15_000_000_000},
	}

	tests := []struct {
		name          string
		mode          string
		userID        uint
		subscriptions []domainbilling.Subscription
		want          string
	}{
		{
			name:   "legacy paid subscriber keeps spending plan credit",
			mode:   "usage",
			userID: 7,
			subscriptions: []domainbilling.Subscription{{
				ID: 11, UserID: 7, PlanID: 2, Status: "active",
				CurrentPeriodStartAt: startAt, CurrentPeriodEndAt: &endAt,
			}},
			want: "period",
		},
		{
			name:   "user without subscription stays pay-as-you-go",
			mode:   "usage",
			userID: 8,
			want:   "usage",
		},
		{
			name:   "expired subscription falls back to pay-as-you-go",
			mode:   "usage",
			userID: 9,
			subscriptions: []domainbilling.Subscription{{
				ID: 13, UserID: 9, PlanID: 2, Status: "active",
				CurrentPeriodStartAt: expiredAt.AddDate(0, -1, 0), CurrentPeriodEndAt: &expiredAt,
			}},
			want: "usage",
		},
		{
			name:   "free plan subscription does not re-enable period billing",
			mode:   "usage",
			userID: 10,
			subscriptions: []domainbilling.Subscription{{
				ID: 14, UserID: 10, PlanID: 1, Status: "active",
				CurrentPeriodStartAt: startAt, CurrentPeriodEndAt: &endAt,
			}},
			want: "usage",
		},
		{
			name:   "internal calls without a user keep the global mode",
			mode:   "usage",
			userID: 0,
			subscriptions: []domainbilling.Subscription{{
				ID: 15, UserID: 7, PlanID: 2, Status: "active",
				CurrentPeriodStartAt: startAt, CurrentPeriodEndAt: &endAt,
			}},
			want: "usage",
		},
		{
			name:   "global period mode is untouched",
			mode:   "period",
			userID: 11,
			want:   "period",
		},
		{
			name:   "self mode is never overridden by a subscription",
			mode:   "self",
			userID: 7,
			subscriptions: []domainbilling.Subscription{{
				ID: 16, UserID: 7, PlanID: 2, Status: "active",
				CurrentPeriodStartAt: startAt, CurrentPeriodEndAt: &endAt,
			}},
			want: "self",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &billingRepositoryStub{
				mode:          tt.mode,
				plans:         plans,
				subscriptions: tt.subscriptions,
			}
			service := NewService(repo)

			mode, err := service.resolveEffectiveBillingMode(t.Context(), tt.userID, now)
			if err != nil {
				t.Fatalf("resolveEffectiveBillingMode() error = %v", err)
			}
			if mode != tt.want {
				t.Fatalf("resolveEffectiveBillingMode() = %q, want %q", mode, tt.want)
			}
		})
	}
}

// 存量订阅用户在按量计费站点上仍要能看到套餐剩余额度，前端据此渲染套餐卡片。
func TestGetBillingOverviewReportsPeriodCreditForLegacySubscribers(t *testing.T) {
	now := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	startAt := now.AddDate(0, -1, 0)
	endAt := now.AddDate(0, 1, 0)
	repo := &billingRepositoryStub{
		mode: "usage",
		plans: []domainbilling.Plan{{
			ID: 2, Code: "pro", Name: "Pro", IsActive: true, PeriodCreditNanousd: 15_000_000_000,
		}},
		subscriptions: []domainbilling.Subscription{{
			ID: 11, UserID: 7, PlanID: 2, Status: "active",
			CurrentPeriodStartAt: startAt, CurrentPeriodEndAt: &endAt,
		}},
	}
	service := NewService(repo)

	overview, err := service.GetBillingOverview(t.Context(), 7, now)
	if err != nil {
		t.Fatalf("GetBillingOverview() error = %v", err)
	}
	if overview.Mode != billingModePeriod {
		t.Fatalf("overview mode = %q, want %q", overview.Mode, billingModePeriod)
	}
	if overview.PeriodCreditNanousd != 15_000_000_000 || overview.PeriodRemainingNanousd != 15_000_000_000 {
		t.Fatalf("period credit = %d/%d, want the full plan credit", overview.PeriodCreditNanousd, overview.PeriodRemainingNanousd)
	}
	if len(overview.SubscriptionEntitlements) != 1 || !overview.SubscriptionEntitlements[0].IsCurrent {
		t.Fatalf("subscription entitlements = %#v, want one current entitlement", overview.SubscriptionEntitlements)
	}
	if overview.Account == nil || overview.Account.BalanceNanousd != 0 {
		t.Fatalf("account = %#v, want an empty usage account next to the plan credit", overview.Account)
	}

	// 没有订阅的用户仍然只看到按量余额。
	plain, err := service.GetBillingOverview(t.Context(), 8, now)
	if err != nil {
		t.Fatalf("GetBillingOverview() error = %v", err)
	}
	if plain.Mode != billingModeUsage || len(plain.SubscriptionEntitlements) != 0 {
		t.Fatalf("overview = %#v, want a pure pay-as-you-go overview", plain)
	}
}
