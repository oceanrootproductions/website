import LegalDocumentPage from "../components/LegalDocumentPage";
import privacyDoc from "../assets/privacypolicies/TwistedDark/Twisted_Dark_VR_Privacy_Policy.txt?raw";

export default function TwistedDarkPrivacy() {
  return (
    <LegalDocumentPage
      heading="Twisted Dark Privacy Policy"
      doc={privacyDoc}
      description="How Ocean Root Productions handles data for the Twisted Dark VR experience on Meta Quest."
      relatedLink={{ to: "/twisteddark/terms", label: "Terms of Use" }}
    />
  );
}
