
import { Document, Image, Page, StyleSheet, Text, View, Font } from '@react-pdf/renderer';

Font.register({
    family: 'Roboto',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf', fontWeight: 700 }, // Bold
    ],
});

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Roboto',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 0,
    },
    header: {
        backgroundColor: '#1e3a8a', // blue-900 like
        color: 'white',
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 100,
    },
    headerText: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 24,
        fontWeight: 700,
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        opacity: 0.9,
    },
    logo: {
        width: 60,
        height: 60,
        objectFit: 'contain',
    },
    content: {
        padding: 30,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    column: {
        flexDirection: 'column',
        flex: 1,
    },
    label: {
        fontSize: 10,
        color: '#64748b', // slate-500
        marginBottom: 4,
    },
    value: {
        fontSize: 12,
        color: '#1e293b', // slate-800
        fontWeight: 700,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
    },
    voucherCodeContainer: {
        marginTop: 20,
        marginBottom: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: 20,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 8,
    },
    voucherCodeLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    voucherCode: {
        fontSize: 48,
        fontWeight: 700,
        color: '#1e3a8a',
        letterSpacing: 4,
    },
    instructionBox: {
        backgroundColor: '#fffbeb', // amber-50
        borderWidth: 1,
        borderColor: '#fcd34d', // amber-200
        borderRadius: 6,
        padding: 15,
        marginBottom: 30,
    },
    instructionTitle: {
        fontSize: 12,
        color: '#92400e', // amber-800
        fontWeight: 700,
        marginBottom: 5,
    },
    instructionText: {
        fontSize: 10,
        color: '#b45309', // amber-700
        lineHeight: 1.4,
    },
    itemsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 20,
    },
    itemsHeader: {
        fontSize: 14,
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: 15,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1e293b',
    },
    itemDetails: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1e293b',
        marginLeft: 15,
    },
    totalContainer: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 12,
        color: '#64748b',
        marginRight: 10,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 700,
        color: '#1e3a8a',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 9,
        color: '#94a3b8',
    },
});

interface OrderItem {
    id: string;
    productName: string;
    variantSize: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    studentName: string;
    imageUrl: string;
}

interface Order {
    orderNumber: string;
    status: 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'RETIRADO' | 'EXPIRADO';
    totalAmount: number;
    createdAt: string;
    expiresAt: string;
    items: OrderItem[];
    pickupInstructions: string;
    customerName: string;
    customerPhone: string;
}

interface VoucherPDFProps {
    order: Order;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value / 100);
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const getStatusColor = (status: Order['status']) => {
    switch (status) {
        case 'AGUARDANDO_PAGAMENTO':
            return { bg: '#fffbeb', text: '#b45309' }; // amber
        case 'PAGO':
            return { bg: '#ecfdf5', text: '#047857' }; // emerald
        case 'RETIRADO':
            return { bg: '#eff6ff', text: '#1d4ed8' }; // blue
        case 'EXPIRADO':
            return { bg: '#fef2f2', text: '#b91c1c' }; // red
        default:
            return { bg: '#f1f5f9', text: '#475569' }; // slate
    }
};

const getStatusLabel = (status: Order['status']) => {
    switch (status) {
        case 'AGUARDANDO_PAGAMENTO':
            return 'Aguardando Pagamento';
        case 'PAGO':
            return 'Pago - Pronto para Retirada';
        case 'RETIRADO':
            return 'Retirado';
        case 'EXPIRADO':
            return 'Voucher Expirado';
        default:
            return status;
    }
};

export const VoucherPDF = ({ order }: VoucherPDFProps) => {
    const statusStyle = getStatusColor(order.status);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>VOUCHER DE RETIRADA</Text>
                        <Text style={styles.subtitle}>{`Pedido #${order.orderNumber}`}</Text>
                    </View>
                    {/* Logo path relative to the public folder */}
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image style={styles.logo} src="/logo.png" />
                </View>

                <View style={styles.content}>
                    {/* Top Info Grid */}
                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Responsável</Text>
                            <Text style={styles.value}>{order.customerName}</Text>
                        </View>
                        <View style={[styles.column, { alignItems: 'flex-end' }]}>
                            <Text style={styles.label}>Status do Pedido</Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    { backgroundColor: statusStyle.bg, color: statusStyle.text },
                                ]}
                            >
                                <Text style={{ fontSize: 10, fontWeight: 700, color: statusStyle.text }}>
                                    {getStatusLabel(order.status)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Telefone</Text>
                            <Text style={styles.value}>{order.customerPhone}</Text>
                        </View>
                        <View style={styles.column}>
                            <Text style={styles.label}>Data do Pedido</Text>
                            <Text style={styles.value}>{formatDate(order.createdAt)}</Text>
                        </View>
                        <View style={[styles.column, { alignItems: 'flex-end' }]}>
                            <Text style={styles.label}>Validade</Text>
                            <Text style={styles.value}>{formatDate(order.expiresAt)}</Text>
                        </View>
                    </View>

                    {/* Big Code */}
                    <View style={styles.voucherCodeContainer}>
                        <Text style={styles.voucherCodeLabel}>CÓDIGO DE RETIRADA</Text>
                        <Text style={styles.voucherCode}>{order.orderNumber}</Text>
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionBox}>
                        <Text style={styles.instructionTitle}>Instruções de Retirada</Text>
                        <Text style={styles.instructionText}>
                            Retire seu pedido na secretaria da unidade, de segunda a sexta, das 7h às 18h.
                            Apresente o código de 6 dígitos acima.
                        </Text>
                    </View>

                    {/* Items List */}
                    <View style={styles.itemsContainer}>
                        <Text style={styles.itemsHeader}>Itens do Pedido</Text>

                        {order.items.map((item) => (
                            <View key={item.id} style={styles.itemRow}>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>
                                        {item.quantity}x {item.productName}
                                    </Text>
                                    <Text style={styles.itemDetails}>
                                        Tamanho: {item.variantSize} | Aluno: {item.studentName}
                                    </Text>
                                </View>
                                <Text style={styles.itemPrice}>{formatCurrency(item.unitPrice * item.quantity)}</Text>
                            </View>
                        ))}

                        <View style={styles.totalContainer}>
                            <Text style={styles.totalLabel}>Total a Pagar:</Text>
                            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Colégio Essência - Portal Digital • Gerado em {new Date().toLocaleDateString('pt-BR')} às{' '}
                    {new Date().toLocaleTimeString('pt-BR')}
                </Text>
            </Page>
        </Document>
    );
};
