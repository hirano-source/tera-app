-- 成果物をリンクでも追加できるように（動画はYouTube/Drive等のURLを貼る）
alter table deliverables add column if not exists url text;        -- リンク成果物のURL
alter table deliverables alter column storage_path drop not null;  -- リンクはファイルパス無し
