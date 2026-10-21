import LegalDocumentPage from "../components/LegalDocumentPage";
import { clayzicsTermsDoc } from "../data/clayzicsLegal";

export default function ClayzicsTerms() {
  return (
    <LegalDocumentPage
      heading="Clayzics! Terms of Use"
      doc={clayzicsTermsDoc}
      badge="Clayzics!"
      description="The full Terms of Use for Clayzics! on Android and the web."
      relatedLink={{ to: "/clayzics/privacy", label: "Privacy policy" }}
    />
  );
}
