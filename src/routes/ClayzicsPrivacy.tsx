import LegalDocumentPage from "../components/LegalDocumentPage";
import { clayzicsPrivacyDoc } from "../data/clayzicsLegal";

export default function ClayzicsPrivacy() {
  return (
    <LegalDocumentPage
      heading="Clayzics! Privacy Policy"
      doc={clayzicsPrivacyDoc}
      badge="Clayzics!"
      description="How OceanRoot Productions handles data for Clayzics! on Android and the web."
      relatedLink={{ to: "/clayzics/terms", label: "Terms of Use" }}
    />
  );
}
