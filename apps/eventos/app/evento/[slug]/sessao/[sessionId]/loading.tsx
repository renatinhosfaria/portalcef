import React from "react";

export default function Loading(): React.JSX.Element { return <div className="content-width animate-pulse py-6 md:py-8"><div className="h-24 rounded-2xl bg-[#e6e9e1]" /><div className="mt-4 h-12 rounded-2xl bg-[#e6e9e1]" /><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><div className="h-[32rem] rounded-2xl bg-[#e6e9e1]" /><div className="hidden h-96 rounded-2xl bg-[#e6e9e1] lg:block" /></div></div>; }
