import { Card } from "@/components/ui";
import { ChangePasswordForm } from "@/components/change-password-form";

export const metadata = { title: "Modifier mon mot de passe" };

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-navy-950">Modifier mon mot de passe</h1>
      <Card className="mt-6 p-6">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
