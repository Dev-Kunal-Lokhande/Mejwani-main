import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Plus, Minus, Send, FileText, RefreshCw, CheckCircle, Clipboard, Save } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthContext, useCart, useAlert } from '../context';
import { API_URL } from '../constants';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Cart'>;
type CartRouteProp = RouteProp<RootStackParamList, 'Cart'>;

interface Table {
  id: number;
  table_number: string;
  table_name: string;
  status: string;
  section_name: string;
}

const CartScreen: React.FC = () => {
  const { colors, spacing, isDark } = useTheme();
  const { captain, token } = useAuthContext();
  const { showAlert } = useAlert();
  const {
    cartItems,
    addToCart,
    removeFromCart,
    updateCartItemNote,
    clearCart,
    activeTableId,
    activeTableName,
    activeSectionName,
  } = useCart();

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CartRouteProp>();
  const { activeOrderId } = route.params || {};

  const [allTables, setAllTables] = useState<Table[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingType, setSubmittingType] = useState<'kot' | 'save' | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSilentSuccess, setIsSilentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hotelId = captain?.hotel_id || 0;

  // Fetch all tables for table shifting/transfer option
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`${API_URL}/tables?hotelId=${hotelId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const json = await res.json();
        if (json.success) {
          setAllTables(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch tables in Cart:', err);
      }
    };
    if (token) fetchTables();
  }, [hotelId, token]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  }, [cartItems]);

  const handleClearCart = () => {
    showAlert({
      title: 'Clear Order',
      message: 'Are you sure you want to clear all items in this order?',
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearCart();
            navigation.navigate('Dashboard');
          },
        },
      ]
    });
  };

  const handleCancelOrder = async () => {
    if (!activeOrderId) return;

    showAlert({
      title: 'Confirm Cancellation',
      message: 'Has the customer cancelled the order? This will cancel the order in the kitchen and release the table.',
      type: 'confirm',
      buttons: [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/bills/${activeOrderId}/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ hotelId }),
              });
              const json = await res.json();
              if (json.success) {
                showAlert({
                  title: 'Success',
                  message: 'Order cancelled and table released.',
                  type: 'success',
                  buttons: [{
                    text: 'OK',
                    onPress: () => {
                      clearCart();
                      navigation.navigate('Dashboard');
                    }
                  }]
                });
              } else {
                showAlert({
                  title: 'Error',
                  message: json.message || 'Failed to cancel order.',
                  type: 'error'
                });
              }
            } catch (err) {
              console.error('Failed to cancel order:', err);
              showAlert({
                title: 'Error',
                message: 'Network request failed.',
                type: 'error'
              });
            }
          },
        },
      ]
    });
  };

  const handleRequestBill = async () => {
    if (!activeTableId) return;

    showAlert({
      title: 'Request Bill',
      message: `Generate and print final bill for Table T-${activeTableName}?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Bill',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/orders/request-bill/${activeTableId}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
              });
              const json = await res.json();
              if (json.success) {
                showAlert({
                  title: 'Success',
                  message: 'Bill request sent to receptionist.',
                  type: 'success',
                  buttons: [{
                    text: 'OK',
                    onPress: () => {
                      clearCart();
                      navigation.navigate('Dashboard');
                    }
                  }]
                });
              } else {
                showAlert({
                  title: 'Error',
                  message: json.message || 'Failed to request bill.',
                  type: 'error'
                });
              }
            } catch (err) {
              console.error('Failed to request bill:', err);
              showAlert({
                title: 'Error',
                message: 'Network request failed.',
                type: 'error'
              });
            }
          },
        },
      ]
    });
  };

  const handleTransferTable = async (targetTable: Table) => {
    if (!activeTableId) return;

    showAlert({
      title: 'Transfer Table',
      message: `Move running order from Table T-${activeTableName} to T-${targetTable.table_name}?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/orders/transfer`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  sourceTableId: activeTableId,
                  targetTableId: targetTable.id,
                }),
              });
              const json = await res.json();
              if (json.success) {
                showAlert({
                  title: 'Success',
                  message: `Table shifted to T-${targetTable.table_name}.`,
                  type: 'success',
                  buttons: [{
                    text: 'OK',
                    onPress: () => {
                      setIsTransferModalOpen(false);
                      clearCart();
                      navigation.navigate('Dashboard');
                    }
                  }]
                });
              } else {
                showAlert({
                  title: 'Error',
                  message: json.message || 'Shift failed.',
                  type: 'error'
                });
              }
            } catch (err) {
              console.error('Failed to shift table:', err);
              showAlert({
                title: 'Error',
                message: 'Network request failed.',
                type: 'error'
              });
            }
          },
        },
      ]
    });
  };

  const handleSubmitKOT = async (isSilent: boolean = false) => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    setSubmittingType(isSilent ? 'save' : 'kot');
    setErrorMessage(null);

    try {
      const itemsPayload = cartItems.map(i => ({
        menu_item_id: i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.qty,
        portion_type: i.portion_type,
        note: i.note,
      }));

      const payload = {
        tableId: activeTableId,
        items: itemsPayload,
        subtotal: subtotal,
        area: activeSectionName,
        table: activeTableName,
        captainName: captain?.fullName || 'Captain',
        printKot: !isSilent,
        saveOnly: isSilent,
      };

      const res = await fetch(`${API_URL}/orders/send-kitchen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setIsSilentSuccess(isSilent);
        setIsSuccessModalOpen(true);
      } else {
        setErrorMessage(json.message || (isSilent ? 'Failed to save order.' : 'Failed to submit KOT to kitchen.'));
      }
    } catch (err) {
      console.error('Failed to submit order:', err);
      setErrorMessage('Network error. Failed to reach server.');
    } finally {
      setIsSubmitting(false);
      setSubmittingType(null);
    }
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    setIsSilentSuccess(false);
    clearCart();
    navigation.navigate('Dashboard');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Order Summary</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Table T-{activeTableName} • {activeSectionName}
          </Text>
        </View>
        <TouchableOpacity style={styles.trashBtn} onPress={handleClearCart}>
          <Trash2 size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Cart Items List */}
      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.cartListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ color: colors.textMuted }}>No items in cart.</Text>
          </View>
        }
        renderItem={({ item }) => {
          return (
            <View style={[styles.cartItemCard, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemSubtotal, { color: colors.primary }]}>
                  ₹{(item.price * item.qty).toFixed(0)}
                </Text>
              </View>
              <Text style={[styles.itemPriceDetail, { color: colors.textSecondary }]}>
                ₹{item.price.toFixed(0)} each
              </Text>

              {/* Quick Choice Buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                {['Roti', 'Chapati', 'Bhakari'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      const current = item.note || '';
                      const prefix = current ? `${current}, ` : '';
                      updateCartItemNote(item.id, `${prefix}${opt}`);
                    }}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: isDark ? '#2e2e2e' : '#f1f5f9',
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: isDark ? '#3e3e3e' : '#e2e8f0',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.textSecondary }}>
                      +{opt}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!!item.note && (
                  <TouchableOpacity
                    onPress={() => updateCartItemNote(item.id, '')}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      backgroundColor: '#fef2f2',
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#ef4444' }}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Special Note Input Box */}
              <View style={[styles.noteContainer, { backgroundColor: isDark ? '#1e1e1e' : '#f8fafc' }]}>
                <FileText size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.noteInput, { color: colors.text }]}
                  placeholder="Special instructions for chef..."
                  placeholderTextColor={colors.textMuted}
                  value={item.note}
                  onChangeText={text => updateCartItemNote(item.id, text)}
                  autoCorrect={false}
                />
              </View>

              {/* Quantity Selector */}
              <View style={styles.cardActionRow}>
                <View style={[styles.qtyControls, { borderColor: colors.primary }]}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => removeFromCart(item.id)}
                  >
                    <Minus size={12} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: colors.text }]}>{item.qty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => addToCart(item, item.portion_type)}
                  >
                    <Plus size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Operational Actions Grid */}
      {cartItems.length > 0 && (
        <View style={[styles.operationsBar, { borderTopWidth: 1.5, borderColor: colors.border, backgroundColor: isDark ? colors.background : '#ffffff' }]}>
          <View style={styles.opsButtonsRow}>
            <TouchableOpacity
              style={[styles.opsButton, { borderColor: colors.border, backgroundColor: isDark ? colors.card : '#f8fafc' }]}
              onPress={() => setIsTransferModalOpen(true)}
            >
              <RefreshCw size={14} color={colors.primary} />
              <Text style={[styles.opsButtonText, { color: colors.text }]}>Shift Table</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.opsButton, { borderColor: colors.border, backgroundColor: isDark ? colors.card : '#f8fafc' }]}
              onPress={handleRequestBill}
            >
              <Clipboard size={14} color="#eab308" />
              <Text style={[styles.opsButtonText, { color: colors.text }]}>Generate Bill</Text>
            </TouchableOpacity>
          </View>

          {activeOrderId ? (
            <TouchableOpacity
              style={[styles.cancelOrderButton, { borderColor: colors.danger, backgroundColor: isDark ? '#2a1a1a' : '#fef2f2' }]}
              onPress={handleCancelOrder}
            >
              <Trash2 size={14} color={colors.danger} />
              <Text style={[styles.cancelOrderButtonText, { color: colors.danger }]}>
                CANCEL ORDER (CUSTOMER CANCELLED)
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Subtotal Display */}
          <View style={styles.subtotalRow}>
            <Text style={[styles.subtotalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.subtotalValue, { color: colors.text }]}>₹{subtotal.toFixed(0)}</Text>
          </View>

          {errorMessage && (
            <Text style={[styles.errorText, { color: colors.danger, marginBottom: 8 }]}>
              {errorMessage}
            </Text>
          )}

          {/* Checkout Buttons: Send to KOT & Save */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Send to Kitchen (KOT) */}
            <TouchableOpacity
              style={[styles.checkoutButton, { backgroundColor: '#ff6b00', flex: 1 }]}
              onPress={() => handleSubmitKOT(false)}
              disabled={isSubmitting}
            >
              {submittingType === 'kot' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.checkoutText, { fontSize: 11 }]}>SEND TO KOT</Text>
                  <Send size={14} color="#ffffff" style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* Save Silently */}
            <TouchableOpacity
              style={[styles.checkoutButton, { backgroundColor: '#4b5563', flex: 1, shadowColor: '#4b5563' }]}
              onPress={() => handleSubmitKOT(true)}
              disabled={isSubmitting}
            >
              {submittingType === 'save' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.checkoutText, { fontSize: 11 }]}>SAVE</Text>
                  <Save size={14} color="#ffffff" style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Success Modal */}
      <Modal visible={isSuccessModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successCard, { backgroundColor: isDark ? colors.card : '#ffffff' }]}>
            <CheckCircle size={54} color={colors.success} style={{ marginBottom: 16 }} />
            <Text style={[styles.successTitle, { color: colors.text }]}>
              {isSilentSuccess ? 'ORDER SAVED!' : 'KOT SENT!'}
            </Text>
            <Text style={[styles.successSub, { color: colors.textSecondary }]}>
              {isSilentSuccess ? 'Order saved to bill silently.' : 'Order sent to printer and kitchen queue.'}
            </Text>
            <TouchableOpacity
              style={[styles.successCloseBtn, { backgroundColor: colors.primary }]}
              onPress={handleSuccessClose}
            >
              <Text style={styles.successCloseBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transfer Table Modal */}
      <Modal visible={isTransferModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.transferCard, { backgroundColor: isDark ? colors.card : '#ffffff' }]}>
            <View style={styles.transferHeader}>
              <Text style={[styles.transferTitle, { color: colors.text }]}>Shift Table Order</Text>
              <TouchableOpacity onPress={() => setIsTransferModalOpen(false)}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={allTables.filter(t => t.id !== activeTableId && t.status === 'available')}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>No empty tables available.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.transferItem, { borderBottomWidth: 1, borderColor: colors.border }]}
                  onPress={() => handleTransferTable(item)}
                >
                  <Text style={[styles.transferItemText, { color: colors.text }]}>
                    Table T-{item.table_name || item.table_number} ({item.section_name})
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  trashBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartListContent: {
    padding: 16,
    paddingBottom: 240, // spacer for operational footer
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 64,
  },
  cartItemCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    flex: 0.8,
  },
  itemSubtotal: {
    fontSize: 15,
    fontWeight: '900',
  },
  itemPriceDetail: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  noteInput: {
    flex: 1,
    height: 34,
    fontSize: 11,
    fontWeight: '600',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    width: 24,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
  },
  operationsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  opsButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  opsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  opsButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cancelOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
    gap: 8,
  },
  cancelOrderButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  subtotalLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  checkoutText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  successSub: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  successCloseBtn: {
    width: '100%',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCloseBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  transferCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '60%',
    borderRadius: 24,
    padding: 20,
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transferTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  transferItem: {
    paddingVertical: 12,
  },
  transferItemText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default CartScreen;
