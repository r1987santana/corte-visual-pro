export function isAdmin(profile: any) {
return profile.role === "admin";
}

export function isEmpleado(profile: any) {
return profile.role === "empleado";
}
