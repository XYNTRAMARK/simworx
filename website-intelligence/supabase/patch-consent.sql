-- Additive repair: voluntary newsletter signup/withdrawal may identify a lead directly.
-- Consent still requires an explicit boolean and (for opt-in) wording/version evidence.
-- Replaces only the new reports collector; no existing website/support objects change.
begin;
create or replace function public.wi_ingest_events(p_events jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  e jsonb; p jsonb; safe_p jsonb; vid text; sid text; eid text; en text; page_path text;
  at_time timestamptz; src text; camp text; ct text; cv text; csid text; cfgid text;
  mail text; lid uuid; inserted_id text; accepted integer := 0; duplicate_count integer := 0;
  consent_value boolean; version_value text; consent_wording text; prior_session_visitor text;
  v_first timestamptz; v_source text; v_campaign text;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 50 then
    raise exception 'Invalid event batch';
  end if;
  for e in select value from jsonb_array_elements(p_events) order by value->>'timestamp',value->>'event_id' loop
    p := coalesce(e->'properties','{}'::jsonb);
    vid := e->>'visitor_id'; sid := e->>'session_id'; eid := e->>'event_id'; en := e->>'event_name';
    page_path := e->>'page_url'; at_time := (e->>'timestamp')::timestamptz;
    src := coalesce(nullif(p->>'source',''),'Direct');
    camp := coalesce(nullif(p->>'campaign',''),nullif(p->>'utm_campaign',''),nullif(p->>'ref_code',''));
    ct := nullif(p->>'configurator_type',''); cv := coalesce(nullif(p->>'configurator_version',''),'unknown');
    if page_path ~* '^/(reports|admin|portal)(/|$)' then continue; end if;
    -- A conflicting retry never changes existing event facts.
    if exists(select 1 from public.wi_events where event_id = eid) then duplicate_count := duplicate_count + 1; continue; end if;
    insert into public.wi_visitors(id,first_seen,last_seen,first_source,first_campaign)
      values(vid,at_time,at_time,src,camp)
      on conflict(id) do update set
        first_source = case when excluded.first_seen < public.wi_visitors.first_seen then excluded.first_source else public.wi_visitors.first_source end,
        first_campaign = case when excluded.first_seen < public.wi_visitors.first_seen then excluded.first_campaign else public.wi_visitors.first_campaign end,
        first_seen = least(public.wi_visitors.first_seen,excluded.first_seen),
        last_seen = greatest(public.wi_visitors.last_seen,excluded.last_seen);
    select visitor_id into prior_session_visitor from public.wi_sessions where id = sid;
    if prior_session_visitor is not null and prior_session_visitor <> vid then raise exception 'Session visitor mismatch'; end if;
    insert into public.wi_sessions(id,visitor_id,start_time,end_time,landing_page,exit_page,source,campaign,country,device)
      values(sid,vid,at_time,at_time,page_path,page_path,src,camp,nullif(p->>'country',''),nullif(p->>'device',''))
      on conflict(id) do update set
        landing_page = case when excluded.start_time < public.wi_sessions.start_time then excluded.landing_page else public.wi_sessions.landing_page end,
        source = case when excluded.start_time < public.wi_sessions.start_time then excluded.source else public.wi_sessions.source end,
        campaign = case when excluded.start_time < public.wi_sessions.start_time then excluded.campaign else public.wi_sessions.campaign end,
        exit_page = case when excluded.end_time >= public.wi_sessions.end_time then excluded.exit_page else public.wi_sessions.exit_page end,
        country = coalesce(excluded.country,public.wi_sessions.country), device = coalesce(excluded.device,public.wi_sessions.device),
        start_time = least(public.wi_sessions.start_time,excluded.start_time), end_time = greatest(public.wi_sessions.end_time,excluded.end_time)
      where public.wi_sessions.visitor_id = excluded.visitor_id;
    if exists(select 1 from public.wi_sessions where id = sid and visitor_id <> vid) then raise exception 'Session visitor mismatch'; end if;
    safe_p := public.wi_redact_properties(p);
    insert into public.wi_events(event_id,visitor_id,session_id,event_name,page_url,timestamp,properties)
      values(eid,vid,sid,en,page_path,at_time,safe_p) on conflict(event_id) do nothing returning event_id into inserted_id;
    if inserted_id is null then duplicate_count := duplicate_count + 1; continue; end if;
    accepted := accepted + 1;
    select lead_id,first_seen,first_source,first_campaign into lid,v_first,v_source,v_campaign from public.wi_visitors where id = vid;

    -- Contact details are accepted only on explicit voluntary identity/conversion events.
    mail := lower(btrim(coalesce(p->>'email',p#>>'{contact,email}','')));
    if en in ('identify','email_entered','enquiry_submitted','contact_form_submitted','newsletter_subscribed','marketing_consent_given','marketing_consent_withdrawn') and mail ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      insert into public.wi_leads(email,name,company,telephone,country,visitor_ids,first_seen,last_seen,first_source,latest_source,first_campaign,latest_campaign,simulator_interest)
        values(mail,nullif(coalesce(p->>'name',p#>>'{contact,name}'),''),nullif(coalesce(p->>'company',p#>>'{contact,company}'),''),nullif(coalesce(p->>'telephone',p#>>'{contact,telephone}'),''),nullif(p->>'country',''),array[vid],v_first,at_time,v_source,src,v_campaign,camp,nullif(p->>'simulator_category',''))
        on conflict(email) do update set
          name = coalesce(excluded.name,public.wi_leads.name), company = coalesce(excluded.company,public.wi_leads.company),
          telephone = coalesce(excluded.telephone,public.wi_leads.telephone), country = coalesce(excluded.country,public.wi_leads.country),
          visitor_ids = case when vid = any(public.wi_leads.visitor_ids) then public.wi_leads.visitor_ids else array_append(public.wi_leads.visitor_ids,vid) end,
          first_source = case when excluded.first_seen < public.wi_leads.first_seen then excluded.first_source else public.wi_leads.first_source end,
          first_campaign = case when excluded.first_seen < public.wi_leads.first_seen then excluded.first_campaign else public.wi_leads.first_campaign end,
          latest_source = case when excluded.last_seen >= public.wi_leads.last_seen then excluded.latest_source else public.wi_leads.latest_source end,
          latest_campaign = case when excluded.last_seen >= public.wi_leads.last_seen then excluded.latest_campaign else public.wi_leads.latest_campaign end,
          first_seen = least(public.wi_leads.first_seen,excluded.first_seen), last_seen = greatest(public.wi_leads.last_seen,excluded.last_seen),
          simulator_interest = coalesce(excluded.simulator_interest,public.wi_leads.simulator_interest)
        returning id into lid;
      update public.wi_visitors set lead_id = lid where id = vid;
      update public.wi_configurations set lead_id = lid where visitor_id = vid and lead_id is null;
    end if;
    if lid is not null then
      update public.wi_leads set
        latest_source = case when at_time >= last_seen then src else latest_source end,
        latest_campaign = case when at_time >= last_seen then camp else latest_campaign end,
        simulator_interest = case when at_time >= last_seen then coalesce(nullif(p->>'simulator_category',''),simulator_interest) else simulator_interest end,
        last_seen = greatest(last_seen,at_time)
        where id = lid;
      consent_value := null;
      if jsonb_typeof(p->'marketing_consent') = 'boolean' then consent_value := (p->>'marketing_consent')::boolean; end if;
      if en = 'marketing_consent_withdrawn' then consent_value := false; end if;
      version_value := nullif(p->>'consent_text_version','');
      consent_wording := nullif(p->>'consent_text','');
      -- An email delivery request alone never grants newsletter consent.
      if consent_value is not null and (not consent_value or (version_value is not null and consent_wording is not null)) then
        insert into public.wi_marketing_consents(id,lead_id,consent,timestamp,source,consent_text_version,consent_text)
          values(eid,lid,consent_value,at_time,page_path,version_value,consent_wording) on conflict(id) do nothing;
        update public.wi_leads set marketing_consent = consent_value,consent_timestamp = at_time,
          consent_text_version = version_value,consent_source = page_path
          where id = lid and (consent_timestamp is null or at_time >= consent_timestamp);
      end if;
    end if;

    if en = 'page_view' then
      insert into public.wi_page_views(id,visitor_id,session_id,url,page_title,timestamp)
        values(eid,vid,sid,page_path,left(p->>'page_title',300),at_time);
    elsif en in ('page_engagement','engagement','scroll_depth') then
      update public.wi_page_views set
        engagement_time = greatest(engagement_time,least(86400,greatest(0,coalesce((p->>'engagement_time')::numeric,(p->>'engagement_seconds')::numeric,0)))),
        scroll_depth = greatest(scroll_depth,least(100,greatest(0,coalesce((p->>'scroll_depth')::numeric,0))))
        where visitor_id = vid and session_id = sid and id = coalesce(nullif(p->>'page_view_id',''),(select id from public.wi_page_views where session_id = sid and url = page_path and timestamp <= at_time order by timestamp desc limit 1));
    end if;
    if en = 'session_started' then
      insert into public.wi_attribution(id,visitor_id,session_id,source,medium,campaign,content,term,ref_code,referrer_domain,timestamp)
        values(eid,vid,sid,src,p->>'utm_medium',camp,p->>'utm_content',p->>'utm_term',p->>'ref_code',p->>'referrer_domain',at_time);
    end if;
    if ct is not null then
      csid := coalesce(nullif(p->>'configurator_session_id',''),sid||':'||ct||':'||cv);
      insert into public.wi_configurator_sessions(id,visitor_id,session_id,configurator_type,configurator_version,started_at,last_step,last_step_at,simulator_category,simulator_model)
        values(csid,vid,sid,ct,cv,at_time,en,at_time,nullif(p->>'simulator_category',''),nullif(p->>'simulator_model',''))
        on conflict(id) do update set
          last_step = case when excluded.last_step_at >= public.wi_configurator_sessions.last_step_at then excluded.last_step else public.wi_configurator_sessions.last_step end,
          last_step_at = greatest(public.wi_configurator_sessions.last_step_at,excluded.last_step_at),
          started_at = least(public.wi_configurator_sessions.started_at,excluded.started_at),
          simulator_category = coalesce(excluded.simulator_category,public.wi_configurator_sessions.simulator_category),
          simulator_model = coalesce(excluded.simulator_model,public.wi_configurator_sessions.simulator_model)
        where public.wi_configurator_sessions.visitor_id = excluded.visitor_id and public.wi_configurator_sessions.session_id = excluded.session_id
          and public.wi_configurator_sessions.configurator_type = excluded.configurator_type and public.wi_configurator_sessions.configurator_version = excluded.configurator_version;
      if exists(select 1 from public.wi_configurator_sessions where id = csid and (visitor_id <> vid or session_id <> sid or configurator_type <> ct or configurator_version <> cv)) then raise exception 'Configurator session mismatch'; end if;
      cfgid := coalesce(nullif(p->>'configuration_id',''),eid);
      if en in ('configuration_completed','projection_configuration_completed','led_configuration_completed') then
        update public.wi_configurator_sessions set completed_at = coalesce(completed_at,at_time) where id = csid;
        insert into public.wi_configurations(id,configurator_session_id,visitor_id,session_id,lead_id,configurator_type,simulator_category,simulator_model,configuration_json,estimated_price,currency,created_at,attribution)
          values(cfgid,csid,vid,sid,lid,ct,nullif(p->>'simulator_category',''),nullif(p->>'simulator_model',''),coalesce(safe_p->'configuration_json',safe_p->'configuration',safe_p),
            case when (p->>'estimated_price') ~ '^\d+(\.\d+)?$' then (p->>'estimated_price')::numeric else null end,
            case when (p->>'currency') ~ '^[A-Z]{3}$' then p->>'currency' else null end,at_time,
            jsonb_build_object('source',src,'campaign',camp,'ref_code',p->>'ref_code','utm_source',p->>'utm_source','utm_medium',p->>'utm_medium'))
          on conflict(id) do nothing;
      end if;
      if en = 'configuration_emailed' and nullif(p->>'configuration_id','') is not null then
        update public.wi_configurations set emailed = true where id = p->>'configuration_id' and visitor_id = vid;
      end if;
      if en in ('enquiry_submitted','contact_form_submitted') then
        update public.wi_configurations set enquiry_status = 'SUBMITTED' where visitor_id = vid and (id = p->>'configuration_id' or (p->>'configuration_id' is null and session_id = sid));
      end if;
    end if;
    if en in ('configuration_completed','led_configuration_completed','projection_configuration_completed','email_entered','configuration_emailed','enquiry_submitted','contact_form_submitted') then
      update public.wi_sessions set converted = true where id = sid;
    end if;
  end loop;
  return jsonb_build_object('accepted',accepted,'duplicates',duplicate_count);
end $$;

revoke all on function public.wi_ingest_events(jsonb) from public, anon, authenticated;
grant execute on function public.wi_ingest_events(jsonb) to service_role;
commit;
