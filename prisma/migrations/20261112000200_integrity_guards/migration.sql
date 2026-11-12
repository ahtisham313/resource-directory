-- Keep cross-field rules in migrations so direct database writes have the same safeguards.
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_normalized_email"
  CHECK (email = lower(btrim(email)) AND position('@' in email) > 1);
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_normalized_email"
  CHECK (email = lower(btrim(email)) AND position('@' in email) > 1);
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_token_hash"
  CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_expiry"
  CHECK ("expiresAt" > "createdAt" AND ("acceptedAt" IS NULL OR "acceptedAt" <= "expiresAt"));
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_published_version_required"
  CHECK (status <> 'PUBLISHED' OR "publishedVersionId" IS NOT NULL);
ALTER TABLE "SurveySection" ADD CONSTRAINT "SurveySection_nonnegative_order" CHECK ("order" >= 0);
ALTER TABLE "SurveyField" ADD CONSTRAINT "SurveyField_nonnegative_order" CHECK ("order" >= 0);
ALTER TABLE "SurveyField" ADD CONSTRAINT "SurveyField_rules_object" CHECK (jsonb_typeof("validationRules") = 'object');
ALTER TABLE "SurveyFieldOption" ADD CONSTRAINT "SurveyFieldOption_nonnegative_order" CHECK ("order" >= 0);
ALTER TABLE "SurveyVersion" ADD CONSTRAINT "SurveyVersion_positive_number" CHECK ("versionNumber" > 0);
ALTER TABLE "SurveyVersion" ADD CONSTRAINT "SurveyVersion_snapshot_object" CHECK (jsonb_typeof(snapshot) = 'object');
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_answers_object" CHECK (jsonb_typeof(answers) = 'object');
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_review_state"
  CHECK ((status = 'PENDING' AND "reviewedAt" IS NULL AND "reviewerId" IS NULL)
      OR (status <> 'PENDING' AND "reviewedAt" IS NOT NULL));
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_answers_object" CHECK (jsonb_typeof("currentAnswers") = 'object');
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_coordinate_pair"
  CHECK ((latitude IS NULL AND longitude IS NULL)
      OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));

-- Published definitions remain intact even if a future nested write bypasses a service guard.
CREATE FUNCTION prevent_survey_version_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published survey versions are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER survey_version_immutable
  BEFORE UPDATE OR DELETE ON "SurveyVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_survey_version_change();

CREATE FUNCTION preserve_original_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.answers IS DISTINCT FROM OLD.answers
    OR NEW."surveyId" IS DISTINCT FROM OLD."surveyId"
    OR NEW."surveyVersionId" IS DISTINCT FROM OLD."surveyVersionId"
    OR NEW."uploadedImageKey" IS DISTINCT FROM OLD."uploadedImageKey"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Original submitted data is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status <> 'APPROVED' AND EXISTS (SELECT 1 FROM "Resource" WHERE "sourceResponseId" = OLD.id) THEN
    RAISE EXCEPTION 'A published resource must retain an approved source response' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER survey_response_preserve_original
  BEFORE UPDATE ON "SurveyResponse"
  FOR EACH ROW EXECUTE FUNCTION preserve_original_submission();

CREATE FUNCTION require_approved_resource_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "SurveyResponse"
    WHERE id = NEW."sourceResponseId" AND "surveyVersionId" = NEW."surveyVersionId" AND status = 'APPROVED') THEN
    RAISE EXCEPTION 'Resources require an approved response from the same version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER resource_approved_source
  BEFORE INSERT OR UPDATE OF "sourceResponseId", "surveyVersionId" ON "Resource"
  FOR EACH ROW EXECUTE FUNCTION require_approved_resource_source();
