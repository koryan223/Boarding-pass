import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams

  // since normal sign-ins go directly to the appropriate dashboard
  if (params.code) {
    const code = Array.isArray(params.code) ? params.code[0] : params.code
    // Default to reset-password since regular logins don't come through here with a code
    redirect(`/auth/callback?code=${code}&next=/auth/reset-password`)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-sans font-sans font-sans">&#39;Board&#39;-ing Pass </CardTitle>
            <CardDescription>{"Get it? Because 'Room' and 'Board'"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild size="lg">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/sign-up">Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
