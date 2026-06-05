import { supabase } from "./supabase";

export async function getUser() {
const { data } = await supabase.auth.getUser();
return data.user;
}

export async function getProfile() {
const user = await getUser();
if (!user) throw new Error("No autenticado");

const { data, error } = await supabase
.from("profiles")
.select("*")
.eq("id", user.id)
.single();

if (error) throw error;
return data;
}
