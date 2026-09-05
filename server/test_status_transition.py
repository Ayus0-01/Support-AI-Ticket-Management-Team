from apps.tickets.services import (
    transition_ticket_status,
)


TICKET_ID = "IT-2026-000006"

ACTOR_USER_ID = "6a7ddd5afaf0daaf72fc2266"


print("=" * 80)
print("STATUS TRANSITION TEST")
print("=" * 80)


print("\nTEST 1: Open -> In Progress")

result = transition_ticket_status(
    ticket_id=TICKET_ID,
    new_status="In Progress",
    actor_user_id=ACTOR_USER_ID,
)

print(result)


print("\nTEST 2: In Progress -> Resolved")

result = transition_ticket_status(
    ticket_id=TICKET_ID,
    new_status="Resolved",
    actor_user_id=ACTOR_USER_ID,
)

print(result)


print("\nTEST 3: Resolved -> In Progress")

result = transition_ticket_status(
    ticket_id=TICKET_ID,
    new_status="In Progress",
    actor_user_id=ACTOR_USER_ID,
)

print(result)


print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)