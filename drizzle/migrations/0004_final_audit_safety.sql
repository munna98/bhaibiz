CREATE OR REPLACE FUNCTION public.worker_outstanding(_worker uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; result bigint;
BEGIN
 SELECT company_id INTO cid FROM public.workers WHERE id = _worker;
 IF cid IS NULL OR NOT public.is_member(cid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT earned_paise - collected_paise - adjusted_paise INTO result FROM public.worker_balances WHERE worker_id = _worker;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.lock_attendance_worker() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM 1 FROM public.workers WHERE id = NEW.worker_id FOR UPDATE; RETURN NEW; END $$;
CREATE TRIGGER attendance_worker_lock BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.lock_attendance_worker();

CREATE OR REPLACE FUNCTION public.void_payment(_payment uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; wid uuid;
BEGIN
 SELECT worker_id INTO wid FROM public.payments WHERE id = _payment;
 PERFORM 1 FROM public.workers WHERE id = wid FOR UPDATE;
 SELECT * INTO p FROM public.payments WHERE id = _payment FOR UPDATE;
 IF p.id IS NULL OR NOT public.has_role(p.company_id, 'owner') THEN RAISE EXCEPTION 'Only the owner can void a payment'; END IF;
 IF p.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Payment is already void'; END IF;
 IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is needed'; END IF;
 UPDATE public.payments SET voided_at = now(), void_reason = trim(_reason), voided_by = auth.uid() WHERE id = _payment;
END $$;

CREATE OR REPLACE FUNCTION public.set_worker_status(_worker uuid, _status public.worker_status, _date date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; effective date := coalesce(_date, (now() at time zone 'Asia/Kolkata')::date); latest date;
BEGIN
 SELECT * INTO w FROM public.workers WHERE id = _worker FOR UPDATE;
 IF w.id IS NULL OR NOT public.can_manage_workers(w.company_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF effective > (now() at time zone 'Asia/Kolkata')::date OR effective < w.joining_date THEN RAISE EXCEPTION 'Choose a date between joining date and today'; END IF;
 SELECT max(effective_date) INTO latest FROM public.worker_status_history WHERE worker_id = _worker;
 IF effective < latest THEN RAISE EXCEPTION 'Status changes cannot predate the latest status record'; END IF;
 IF w.status = _status THEN RETURN; END IF;
 IF _status = 'inactive' AND EXISTS (SELECT 1 FROM public.attendance WHERE worker_id = _worker AND work_date >= effective AND status = 'worked') THEN RAISE EXCEPTION 'Correct worked attendance from this date first; void any linked payments before correcting'; END IF;
 UPDATE public.workers SET status = _status WHERE id = _worker;
 INSERT INTO public.worker_status_history(company_id, worker_id, status, effective_date, reason, changed_by) VALUES (w.company_id, _worker, _status, effective, nullif(trim(_reason),''), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.audit_business_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_ jsonb; old_ jsonb; cid uuid; eid uuid; action_ text; details_ jsonb := '{}'::jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
 row_ := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 old_ := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 cid := CASE WHEN TG_TABLE_NAME = 'companies' THEN (row_->>'id')::uuid ELSE (row_->>'company_id')::uuid END;
 eid := (row_->>'id')::uuid;
 IF TG_TABLE_NAME = 'workers' THEN
   IF TG_OP = 'UPDATE' AND (row_ - ARRAY['updated_at','status','aadhaar_hash','aadhaar_last4']) = (old_ - ARRAY['updated_at','status','aadhaar_hash','aadhaar_last4']) THEN RETURN NEW; END IF;
   action_ := CASE WHEN TG_OP = 'INSERT' THEN 'worker_created' ELSE 'worker_updated' END;
 ELSIF TG_TABLE_NAME = 'payments' THEN
   action_ := CASE WHEN TG_OP = 'INSERT' THEN 'payment_recorded' ELSE 'payment_voided' END;
   details_ := jsonb_build_object('amount_paise', row_->'amount_paise', 'receipt_no', row_->'receipt_no', 'reason', row_->'void_reason');
 ELSIF TG_TABLE_NAME = 'advances' THEN action_ := 'advance_recorded'; details_ := jsonb_build_object('amount_paise', row_->'amount_paise', 'reason', row_->'reason');
 ELSIF TG_TABLE_NAME = 'advance_repayments' THEN action_ := 'repayment_recorded'; details_ := jsonb_build_object('amount_paise', row_->'amount_paise');
 ELSIF TG_TABLE_NAME = 'adjustments' THEN action_ := 'adjustment_recorded'; details_ := jsonb_build_object('amount_paise', row_->'amount_paise', 'reason', row_->'reason', 'kind', row_->'kind');
 ELSIF TG_TABLE_NAME = 'attendance' THEN action_ := 'attendance_changed'; details_ := jsonb_build_object('work_date', row_->'work_date', 'status', row_->'status', 'old_status', old_->'status');
 ELSIF TG_TABLE_NAME = 'worker_status_history' THEN action_ := 'status_changed'; eid := (row_->>'worker_id')::uuid; details_ := jsonb_build_object('status', row_->'status', 'work_date', row_->'effective_date', 'reason', row_->'reason');
 ELSIF TG_TABLE_NAME = 'commission_agreements' THEN action_ := 'rate_added'; details_ := jsonb_build_object('amount_paise', row_->'daily_rate_paise', 'work_date', row_->'effective_from');
 ELSIF TG_TABLE_NAME = 'companies' THEN
   IF (row_ - ARRAY['worker_seq']) = (old_ - ARRAY['worker_seq']) THEN RETURN NEW; END IF;
   action_ := 'company_updated';
 ELSIF TG_TABLE_NAME = 'memberships' THEN action_ := CASE TG_OP WHEN 'INSERT' THEN 'member_added' WHEN 'UPDATE' THEN 'member_updated' ELSE 'member_removed' END; details_ := jsonb_build_object('role', row_->'role');
 ELSIF TG_TABLE_NAME = 'invites' THEN action_ := CASE TG_OP WHEN 'INSERT' THEN 'invite_added' WHEN 'UPDATE' THEN 'invite_updated' ELSE 'invite_removed' END;
 ELSIF TG_TABLE_NAME = 'worker_documents' THEN action_ := 'document_uploaded';
 END IF;
 IF action_ IS NOT NULL THEN INSERT INTO public.audit_log(company_id, actor_id, entity, entity_id, action, details) VALUES (cid, auth.uid(), TG_TABLE_NAME, eid, action_, details_); END IF;
 RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER audit_workers AFTER INSERT OR UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_advances AFTER INSERT ON public.advances FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_repayments AFTER INSERT ON public.advance_repayments FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_adjustments AFTER INSERT ON public.adjustments FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_attendance AFTER INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_status AFTER INSERT ON public.worker_status_history FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_rates AFTER INSERT ON public.commission_agreements FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_company AFTER UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_memberships AFTER INSERT OR UPDATE OR DELETE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_invites AFTER INSERT OR UPDATE OR DELETE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_documents AFTER INSERT ON public.worker_documents FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
REVOKE EXECUTE ON FUNCTION public.audit_business_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_attendance_worker() FROM PUBLIC, anon, authenticated;