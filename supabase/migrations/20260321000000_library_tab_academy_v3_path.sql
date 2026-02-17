-- Canonicalize the Library tab path to academy-v3 modules.
update tab_configurations
set path = '/members/academy-v3/modules'
where tab_id = 'library'
  and path <> '/members/academy-v3/modules';
