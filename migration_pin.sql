-- Add PIN column for simple auth
alter table players add column pin text default '1234';

-- Insert Official Players if they don't exist
insert into players (name, pin)
values 
  ('Rodrigo', '1111'),
  ('Alex', '1111'),
  ('Rodrigo Jr', '1111'),
  ('Rudy', '1111'),
  ('Rodolfo', '1111'),
  ('Mayito', '1111'),
  ('Beto', '1111'),
  ('J Miguel', '1111'),
  ('Germán', '1111'),
  ('Juan C', '1111'),
  ('Carlos R', '1111'),
  ('Edgar', '1111'),
  ('Paco', '1111'),
  ('Rubén', '1111'),
  ('Mike', '1111'),
  ('Buru', '1111')
on conflict do nothing; 
-- Note: 'name' needs to be unique for conflict to work, or we just rely on ID. 
-- For this MVP script, we'll assume fresh table or handle duplicates manually.
