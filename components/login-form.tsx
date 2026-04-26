"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("naturalist@biocatalog.local");
  const [password, setPassword] = useState("biocatalog-demo");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setErrorMessage("Invalid credentials.");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <label className="field">
        <span>Email</span>
        <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      </label>
      <label className="field">
        <span>Password</span>
        <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
      </label>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}