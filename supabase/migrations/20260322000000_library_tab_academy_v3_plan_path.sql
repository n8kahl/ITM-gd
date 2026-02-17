-- Canonicalize the Library tab path to the Academy plan landing route.
update tab_configurations
set path = '/members/academy-v3'
where tab_id = 'library'
  and path <> '/members/academy-v3';
