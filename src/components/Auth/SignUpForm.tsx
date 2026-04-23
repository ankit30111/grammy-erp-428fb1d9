import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      // First, sign up the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (authData.user) {
        // Create user account record using the auth user's ID
        const { error: accountError } = await supabase
          .from("user_accounts")
          .insert({
            id: authData.user.id, // Use the same ID as auth.users
            username: email,
            email: email,
            full_name: name,
            role: "user",
            // password_hash has a DB default of 'managed_by_auth' — Supabase
            // Auth handles real credentials in auth.users.
          });

        if (accountError) {
          console.error("Error creating user account:", accountError);
          toast.error("Account created but failed to set up profile. Please contact admin.");
        } else {
          toast.success("Account created successfully! Please check your email for verification.");
          navigate("/");
        }
      }
    } catch (error) {
      console.error("Sign up error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div>
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Enter your full name"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Enter your email"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Create a password"
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign Up
      </Button>
    </form>
  );
}