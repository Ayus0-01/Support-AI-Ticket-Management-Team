from apps.tickets.classification.routing import route_ticket


print("=" * 70)
print("ROUTING TEST")
print("=" * 70)


tests = [
    ("VPN", "NETWORK_SUPPORT"),
    ("NETWORK", "NETWORK_SUPPORT"),
    ("HARDWARE", "HARDWARE_SUPPORT"),
    ("SOFTWARE", "APPLICATION_SUPPORT"),
    ("APPLICATION", "APPLICATION_SUPPORT"),
    ("ACCESS", "ACCESS_MANAGEMENT"),
    ("EMAIL", "EMAIL_SUPPORT"),
    ("SECURITY", "SECURITY_OPERATIONS"),
    ("UNCLASSIFIED", "GENERAL_SUPPORT"),
]


for category, expected_team in tests:

    actual_team = route_ticket(category)

    print(
        f"{category:15} -> "
        f"{actual_team:25} "
        f"{'[PASS]' if actual_team == expected_team else '[FAIL]'}"
    )

    assert actual_team == expected_team


print("\nAll routing tests passed.")