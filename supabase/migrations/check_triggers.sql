SELECT event_object_table, trigger_name, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'purchase_requests';
