import { redirect } from "react-router";

export function loader() { return redirect("/ar", 302); }
export default function Index() { return null; }
