/**
 * PlanningPdfTemplate Component
 * Template PDF usando @react-pdf/renderer
 * Epic 3 - Story 3.4: Geração Automática de PDF
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Registrar fonte padrão (usando Helvetica que já vem incluída)
// Para usar Inter, seria necessário baixar e registrar a fonte
// Font.register({ family: 'Inter', src: '/fonts/Inter-Regular.ttf' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  // Header
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#10B77F",
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  schoolName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#10B77F",
  },
  schoolSubtitle: {
    fontSize: 9,
    color: "#666",
    marginTop: 2,
  },
  documentTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#333",
    textAlign: "right",
  },
  documentSubtitle: {
    fontSize: 10,
    color: "#666",
    textAlign: "right",
    marginTop: 2,
  },
  // Info Grid
  infoGrid: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 4,
    gap: 20,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#333",
  },
  // Sections
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  sectionIcon: {
    width: 20,
    height: 20,
    backgroundColor: "#10B77F20",
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionIconText: {
    fontSize: 10,
    color: "#10B77F",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#333",
  },
  sectionContent: {
    fontSize: 10,
    color: "#444",
    lineHeight: 1.6,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  listBullet: {
    width: 12,
    fontSize: 10,
    color: "#10B77F",
  },
  listText: {
    flex: 1,
    fontSize: 10,
    color: "#444",
  },
  emptyText: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
  },
  // Footer
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  // Page Number
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: "#999",
  },
});

export interface PlanningPdfData {
  turma: string;
  quinzena: string;
  objetivos?: string;
  metodologia?: string;
  recursos?: string[];
  professorName?: string;
}

interface PlanningPdfTemplateProps {
  data: PlanningPdfData;
}

function formatQuinzena(q: string): string {
  const match = q.match(/(\d{4})-Q(\d{2})/);
  if (match) {
    return `Quinzena ${match[2]}/${match[1]}`;
  }
  return q;
}

export function PlanningPdfTemplate({ data }: PlanningPdfTemplateProps) {
  const { turma, quinzena, objetivos, metodologia, recursos, professorName } =
    data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.schoolName}>Escola Essência</Text>
              <Text style={styles.schoolSubtitle}>
                Centro de Educação Fundamental
              </Text>
            </View>
            <View>
              <Text style={styles.documentTitle}>Planejamento Quinzenal</Text>
              <Text style={styles.documentSubtitle}>
                {formatQuinzena(quinzena)}
              </Text>
            </View>
          </View>

          {/* Info Grid */}
          <View style={styles.infoGrid}>
            {professorName && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Professora</Text>
                <Text style={styles.infoValue}>{professorName}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Turma</Text>
              <Text style={styles.infoValue}>{turma}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Período</Text>
              <Text style={styles.infoValue}>{formatQuinzena(quinzena)}</Text>
            </View>
          </View>
        </View>

        {/* Objetivos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>◎</Text>
            </View>
            <Text style={styles.sectionTitle}>Objetivos de Aprendizagem</Text>
          </View>
          {objetivos ? (
            <Text style={styles.sectionContent}>{objetivos}</Text>
          ) : (
            <Text style={styles.emptyText}>Nenhum objetivo definido.</Text>
          )}
        </View>

        {/* Metodologia */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>💡</Text>
            </View>
            <Text style={styles.sectionTitle}>Metodologia</Text>
          </View>
          {metodologia ? (
            <Text style={styles.sectionContent}>{metodologia}</Text>
          ) : (
            <Text style={styles.emptyText}>Nenhuma metodologia definida.</Text>
          )}
        </View>

        {/* Recursos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>📦</Text>
            </View>
            <Text style={styles.sectionTitle}>Recursos e Atividades</Text>
          </View>
          {recursos && recursos.length > 0 ? (
            recursos.map((recurso, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listBullet}>•</Text>
                <Text style={styles.listText}>{recurso}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum recurso adicionado.</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Documento gerado pelo Portal CEF - Escola Essência
          </Text>
          <Text style={styles.footerText}>
            Planejamento Pedagógico - {new Date().getFullYear()}
          </Text>
        </View>

        {/* Page Number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export default PlanningPdfTemplate;
