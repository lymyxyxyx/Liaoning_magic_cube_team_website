ALTER TABLE weekly_big_stack_records ADD COLUMN gender_override TEXT NOT NULL DEFAULT '';
ALTER TABLE weekly_big_stack_records ADD CONSTRAINT big_stack_gender_valid CHECK (gender_override IN ('','男','女','未知'));
