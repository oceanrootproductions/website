import LegalDocumentPage from "../components/LegalDocumentPage";
import { bloopTermsDoc } from "../data/bloopLegal";

export default function BloopTerms() {
  return (
    <LegalDocumentPage
      heading="Bloop Terms of Use"
      doc={bloopTermsDoc}
      badge="Bloop"
      description="The full Terms of Use for Bloop on VR and the web."
      relatedLink={{ to: "/bloop/privacy", label: "Privacy policy" }}
    />
  );
}
