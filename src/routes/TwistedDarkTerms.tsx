import LegalDocumentPage from "../components/LegalDocumentPage";
import termsDoc from "../assets/terms/TwistedDark/Twisted_Dark_VR_Terms_of_Use.txt?raw";

export default function TwistedDarkTerms() {
  return (
    <LegalDocumentPage
      heading="Twisted Dark Terms of Use"
      doc={termsDoc}
      description="The full Terms of Use for the Twisted Dark VR experience on Meta Quest."
      relatedLink={{ to: "/twisteddark/privacy", label: "Privacy policy" }}
    />
  );
}
