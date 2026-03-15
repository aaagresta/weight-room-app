import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { email, password, inviteCode } = await req.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json({ error: "Missing email, password, or invite code." }, { status: 400 });
    }

    if (inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    console.log("ENV CHECK:", {
  hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});


    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server missing Supabase configuration." }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (data.user?.id) {
      await supabaseAdmin.from("profiles").upsert({ id: data.user.id, role: "player" }, { onConflict: "id" });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
