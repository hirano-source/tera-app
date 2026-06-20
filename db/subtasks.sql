-- タスクのサブタスク（ゴール→タスク→タスク、最大2段。3段目はUIで作らせない）
alter table tasks
  add column if not exists parent_task_id uuid references tasks(id) on delete cascade;
create index if not exists tasks_parent_idx on tasks (parent_task_id);
