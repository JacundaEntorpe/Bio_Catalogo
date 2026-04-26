import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams?: {
    callbackUrl?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = searchParams?.callbackUrl || "/";

  return (
    <div className="login-panel stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Authentication</span>
        <h1>Sign in to manage your catalog.</h1>
        <p>The demo seed creates one local user so the editing flow works end to end.</p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
      <div className="stack-sm muted">
        <strong>Demo credentials</strong>
        <span>naturalist@biocatalog.local</span>
        <span>biocatalog-demo</span>
      </div>
    </div>
  );
}