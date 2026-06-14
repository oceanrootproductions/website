import LegalDocumentPage from "../components/LegalDocumentPage";
import { bloopPrivacyDoc } from "../data/bloopLegal";

export default function BloopPrivacy() {
  return (
    <LegalDocumentPage
      heading="Bloop Privacy Policy"
      doc={bloopPrivacyDoc}
      badge="Bloop"
      description="How Ocean Root Productions handles data for Bloop on VR and the web."
      relatedLink={{ to: "/bloop/terms", label: "Terms of Use" }}
    />
  );
}
