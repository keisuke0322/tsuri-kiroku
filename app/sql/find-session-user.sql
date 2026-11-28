SELECT s.user_id AS userId, p.display_name AS fullName
FROM auth_sessions AS s
JOIN profiles AS p ON p.user_id = s.user_id
WHERE s.token_hash = ? AND s.expires_at > ?
