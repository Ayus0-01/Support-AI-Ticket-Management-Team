from apps.tickets.classification.severity_prediction import predict_severity
from apps.tickets.classification.severity_rules import apply_severity_overrides
from apps.tickets.classification.priority import calculate_priority


print("\n" + "=" * 70)
print("TEST 1 - SEVERITY MODEL")
print("=" * 70)

result = predict_severity(
    affected_scope="TEAM",
    work_blocked="YES",
    urgent_feeling="HIGH",
    workaround_available=False,
    category="VPN",
)

print(result)


print("\n" + "=" * 70)
print("TEST 2 - SEVERITY OVERRIDE")
print("=" * 70)

result = apply_severity_overrides(
    severity="MEDIUM",
    category="VPN",
    affected_scope="ORGANISATION",
    is_vip=False,
    subject="VPN connection failing",
    description="The entire site is affected.",
    similar_tickets_last_hour=0,
)

print(result)


print("\n" + "=" * 70)
print("TEST 3 - PRIORITY")
print("=" * 70)

priority = calculate_priority(
    severity="HIGH",
    affected_scope="TEAM",
)

print("Priority:", priority)


print("\n" + "=" * 70)
print("TEST 4 - FULL SEVERITY -> OVERRIDE -> PRIORITY")
print("=" * 70)

model_result = predict_severity(
    affected_scope="ORGANISATION",
    work_blocked="YES",
    urgent_feeling="HIGH",
    workaround_available=False,
    category="NETWORK",
)

print("Model result:")
print(model_result)

override_result = apply_severity_overrides(
    severity=model_result["severity"],
    category="NETWORK",
    affected_scope="ORGANISATION",
    is_vip=False,
    subject="Network outage",
    description="The entire site is down.",
    similar_tickets_last_hour=10,
)

print("\nAfter override:")
print(override_result)

final_priority = calculate_priority(
    severity=override_result["severity"],
    affected_scope="ORGANISATION",
)

print("\nFinal priority:", final_priority)