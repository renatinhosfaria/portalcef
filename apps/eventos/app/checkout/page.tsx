import {FormularioCheckout} from "../../components/formulario-checkout";
export default async function Page({searchParams}:{searchParams:Promise<{assentos?:string}>}){const{assentos}=await searchParams;return <><h1 className="mb-6 text-2xl font-bold">Checkout</h1><FormularioCheckout seatIds={assentos?.split(",").filter(Boolean)??[]}/></>}
