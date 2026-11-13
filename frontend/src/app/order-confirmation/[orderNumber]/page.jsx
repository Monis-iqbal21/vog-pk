import OrderReceipt from "@/components/cart/OrderReceipt";

export default async function OrderConfirmationPage({ params }) {
  const { orderNumber } = await params;
  return <OrderReceipt orderNumber={orderNumber} />;
}
