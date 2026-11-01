-- Run only after applying supabase/schema.sql. Every test row is rolled back.
-- Exercises the real collector transaction rather than reproducing its logic.
begin;
do $$
declare
  prefix text := 'qa_' || replace(gen_random_uuid()::text, '-', '');
  at_time timestamptz := now() - interval '10 minutes';
  e jsonb; result jsonb; v_lead_id uuid; config_id text; rejected boolean := false;
begin
  e := jsonb_build_object('event_id',prefix || '_page','visitor_id',prefix || '_visitor',
    'session_id',prefix || '_session','event_name','page_view',
    'page_url','/visual-systems.html','timestamp',at_time,
    'properties',jsonb_build_object('source','LinkedIn','campaign','QA-CAMPAIGN','page_title','Visual systems'));
  result := public.wi_ingest_events(jsonb_build_array(e));
  if (result->>'accepted')::int <> 1 then raise exception 'First collector insert failed'; end if;
  result := public.wi_ingest_events(jsonb_build_array(e));
  if (result->>'accepted')::int <> 0 or (result->>'duplicates')::int <> 1 then
    raise exception 'Retry did not deduplicate event_id';
  end if;

  e := e || jsonb_build_object('event_id',prefix || '_screen','event_name','screen_configuration_completed',
    'timestamp',at_time + interval '1 minute',
    'properties',jsonb_build_object('configurator_type','led','configurator_version','qa_v1','screen_type','Curved'));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if exists(select 1 from public.wi_configurations where visitor_id = prefix || '_visitor') then
    raise exception 'Screen setup was incorrectly saved as a completed configuration';
  end if;

  config_id := prefix || '_configuration';
  e := e || jsonb_build_object('event_id',prefix || '_complete','event_name','configuration_completed',
    'timestamp',at_time + interval '2 minutes',
    'properties',jsonb_build_object('configurator_type','led','configurator_version','qa_v1',
      'configuration_id',config_id,'simulator_category','Airliner','simulator_model','Boeing 737',
      'estimated_price',54000,'currency','EUR','configuration_json',jsonb_build_object('pixel_pitch','P1.2','contact',jsonb_build_object('email','hidden@example.test'))));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if (select count(*) from public.wi_configurations where visitor_id = prefix || '_visitor') <> 1 then
    raise exception 'Final configuration was not saved once';
  end if;
  if (select configuration_json::text from public.wi_configurations where id = config_id) like '%hidden@example.test%' then
    raise exception 'Contact leaked into saved generic configuration';
  end if;

  e := e || jsonb_build_object('event_id',prefix || '_email','event_name','email_entered',
    'timestamp',at_time + interval '3 minutes',
    'properties',jsonb_build_object('email','  ' || prefix || '@Example.Test  ','name','QA Contact',
      'source','Google Ads','campaign','QA-RETURN','marketing_consent',false,'configurator_type','led','configuration_id',config_id));
  perform public.wi_ingest_events(jsonb_build_array(e));
  select id into v_lead_id from public.wi_leads where email = prefix || '@example.test';
  if v_lead_id is null then raise exception 'Normalized lead was not created'; end if;
  if (select marketing_consent from public.wi_leads where id = v_lead_id) then
    raise exception 'Configuration email implied marketing consent';
  end if;
  if (select first_source from public.wi_leads where id = v_lead_id) <> 'LinkedIn'
    or (select latest_source from public.wi_leads where id = v_lead_id) <> 'Google Ads' then
    raise exception 'First and latest source were not preserved separately';
  end if;
  if (select lead_id from public.wi_configurations where id = config_id) is distinct from v_lead_id then
    raise exception 'Prior anonymous configuration was not linked to new lead';
  end if;
  if (select properties::text from public.wi_events where event_id = prefix || '_email') like '%@%' then
    raise exception 'Identity leaked into generic event facts';
  end if;

  e := e || jsonb_build_object('event_id',prefix || '_email_repeat','timestamp',at_time + interval '4 minutes');
  perform public.wi_ingest_events(jsonb_build_array(e));
  if (select count(*) from public.wi_leads where email = prefix || '@example.test') <> 1 then
    raise exception 'Repeated normalized email created duplicate leads';
  end if;

  e := e || jsonb_build_object('event_id',prefix || '_consent','event_name','marketing_consent_given',
    'timestamp',at_time + interval '5 minutes',
    'properties',jsonb_build_object('marketing_consent',true,'consent_text_version','qa_v1',
      'consent_text','Send me occasional Simworx product news and updates'));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if not (select marketing_consent from public.wi_leads where id = v_lead_id) then
    raise exception 'Explicit consent was not saved';
  end if;
  e := e || jsonb_build_object('event_id',prefix || '_withdraw','event_name','marketing_consent_withdrawn',
    'timestamp',at_time + interval '6 minutes','properties',jsonb_build_object('marketing_consent',false));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if (select marketing_consent from public.wi_leads where id = v_lead_id) then
    raise exception 'Consent withdrawal did not exclude subscriber';
  end if;
  e := e || jsonb_build_object('event_id',prefix || '_stale_consent','event_name','marketing_consent_given',
    'timestamp',at_time + interval '5 minutes 30 seconds',
    'properties',jsonb_build_object('marketing_consent',true,'consent_text_version','qa_v1','consent_text','Send me news'));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if (select marketing_consent from public.wi_leads where id = v_lead_id) then
    raise exception 'Out-of-order consent overrode a later withdrawal';
  end if;

  -- A collector client cannot change somebody else's page engagement by
  -- supplying that page_view_id in an otherwise valid new session event.
  e := jsonb_build_object('event_id',prefix || '_foreign_engagement',
    'visitor_id',prefix || '_other_visitor','session_id',prefix || '_other_session',
    'event_name','page_engagement','page_url','/visual-systems.html','timestamp',at_time,
    'properties',jsonb_build_object('page_view_id',prefix || '_page','engagement_time',999));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if (select engagement_time from public.wi_page_views where id = prefix || '_page') <> 0 then
    raise exception 'Foreign session modified another page-view record';
  end if;
  e := e || jsonb_build_object('event_id',prefix || '_foreign_config_session',
    'event_name','simulator_category_selected',
    'properties',jsonb_build_object('configurator_type','led','configurator_version','qa_v1',
      'configurator_session_id',prefix || '_session:led:qa_v1','simulator_category','Fighter'));
  begin
    perform public.wi_ingest_events(jsonb_build_array(e));
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'Foreign configurator-session ownership was accepted'; end if;

  -- A standalone newsletter form can identify and consent without a prior email-delivery event.
  e := jsonb_build_object('event_id',prefix || '_newsletter_only','visitor_id',prefix || '_newsletter_visitor',
    'session_id',prefix || '_newsletter_session','event_name','marketing_consent_given',
    'page_url','/visual-systems.html','timestamp',at_time + interval '7 minutes',
    'properties',jsonb_build_object('email',prefix || '_newsletter@example.test','marketing_consent',true,
      'consent_text_version','qa_v1','consent_text','Send me occasional Simworx product news and updates'));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if not exists(select 1 from public.wi_leads where email = prefix || '_newsletter@example.test' and marketing_consent) then
    raise exception 'Standalone newsletter signup failed to create a consented lead';
  end if;
  e := jsonb_build_object('event_id',prefix || '_withdraw_only','visitor_id',prefix || '_withdraw_visitor',
    'session_id',prefix || '_withdraw_session','event_name','marketing_consent_withdrawn',
    'page_url','/visual-systems.html','timestamp',at_time + interval '8 minutes',
    'properties',jsonb_build_object('email',prefix || '_newsletter@example.test','marketing_consent',false));
  perform public.wi_ingest_events(jsonb_build_array(e));
  if (select marketing_consent from public.wi_leads where email = prefix || '_newsletter@example.test') then
    raise exception 'Standalone email withdrawal failed to resolve the existing normalized lead';
  end if;
  if has_table_privilege('anon','public.wi_leads','SELECT')
    or has_table_privilege('authenticated','public.wi_leads','SELECT')
    or has_function_privilege('anon','public.wi_ingest_events(jsonb)','EXECUTE') then
    raise exception 'Public role has privileged data access';
  end if;
  raise notice 'Collector contract assertions passed; transaction will roll back';
end $$;
rollback;
