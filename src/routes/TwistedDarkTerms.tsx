import LegalDocumentPage from "../components/LegalDocumentPage";
import { twistedDarkTermsDoc } from "../data/twistedDarkLegal";

export default function TwistedDarkTerms() {
  return (
    <LegalDocumentPage
      heading="Twisted Dark Terms of Use"
      doc={twistedDarkTermsDoc}
      description="The full Terms of Use for the Twisted Dark VR experience on Meta Quest."
      relatedLink={{ to: "/twisteddark/privacy", label: "Privacy policy" }}
    />
  );
}
