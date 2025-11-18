-- 更新用户8582211的第一章、第二章所有知识点进度为0.9
-- 使用INSERT ... ON DUPLICATE KEY UPDATE确保记录存在则更新，不存在则插入

-- 第一章知识点（tag_id: 1001-1019）
INSERT INTO tracker_tag_user_record (user_id, tag_id, pass_rate, create_time, update_time) VALUES
(8582211, 1001, 0.9, NOW(), NOW()),
(8582211, 1002, 0.9, NOW(), NOW()),
(8582211, 1003, 0.9, NOW(), NOW()),
(8582211, 1004, 0.9, NOW(), NOW()),
(8582211, 1005, 0.9, NOW(), NOW()),
(8582211, 1006, 0.9, NOW(), NOW()),
(8582211, 1007, 0.9, NOW(), NOW()),
(8582211, 1009, 0.9, NOW(), NOW()),
(8582211, 1010, 0.9, NOW(), NOW()),
(8582211, 1011, 0.9, NOW(), NOW()),
(8582211, 1012, 0.9, NOW(), NOW()),
(8582211, 1013, 0.9, NOW(), NOW()),
(8582211, 1014, 0.9, NOW(), NOW()),
(8582211, 1015, 0.9, NOW(), NOW()),
(8582211, 1016, 0.9, NOW(), NOW()),
(8582211, 1017, 0.9, NOW(), NOW()),
(8582211, 1019, 0.9, NOW(), NOW())
ON DUPLICATE KEY UPDATE pass_rate = 0.9, update_time = NOW();

-- 第二章知识点（tag_id: 1101-1112）
INSERT INTO tracker_tag_user_record (user_id, tag_id, pass_rate, create_time, update_time) VALUES
(8582211, 1101, 0.9, NOW(), NOW()),
(8582211, 1102, 0.9, NOW(), NOW()),
(8582211, 1103, 0.9, NOW(), NOW()),
(8582211, 1104, 0.9, NOW(), NOW()),
(8582211, 1105, 0.9, NOW(), NOW()),
(8582211, 1106, 0.9, NOW(), NOW()),
(8582211, 1107, 0.9, NOW(), NOW()),
(8582211, 1108, 0.9, NOW(), NOW()),
(8582211, 1109, 0.9, NOW(), NOW()),
(8582211, 1110, 0.9, NOW(), NOW()),
(8582211, 1111, 0.9, NOW(), NOW()),
(8582211, 1112, 0.9, NOW(), NOW())
ON DUPLICATE KEY UPDATE pass_rate = 0.9, update_time = NOW();

