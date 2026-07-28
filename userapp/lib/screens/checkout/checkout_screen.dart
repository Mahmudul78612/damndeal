import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../services/cart_service.dart';
import '../../theme/app_theme.dart';
import '../cart/cart_screen.dart' show DashedDivider;

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _api = ApiService();
  Razorpay? _razorpay;
  Map<String, dynamic>? _pendingOrder;
  List<dynamic> _addresses = [];
  String? _selectedAddressId;
  Map<String, dynamic>? _selectedAddress;
  Map<String, dynamic>? _estimate;
  bool _loadingAddr = true;
  bool _loadingEstimate = false;
  bool _placing = false;
  String _paymentMethod = 'cod';
  final _noteController = TextEditingController();
  String? _error;

  static const _ddgoGreen = Color(0xFF0D7A30);

  @override
  void initState() {
    super.initState();
    _loadAddresses();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _noteController.dispose();
    _razorpay?.clear();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    try {
      final res = await _api.get('/user/addresses');
      _addresses = res['addresses'] ?? [];
      if (_addresses.isNotEmpty) {
        final defaultAddr = _addresses.firstWhere((a) => a['isDefault'] == true, orElse: () => _addresses.first);
        _selectedAddressId = defaultAddr['_id'];
        _selectedAddress = Map<String, dynamic>.from(defaultAddr);
        _getEstimate();
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingAddr = false);
  }

  Future<void> _getEstimate() async {
    if (_selectedAddressId == null) return;
    setState(() { _loadingEstimate = true; _estimate = null; });
    try {
      final pmForApi = _paymentMethod == 'online' ? 'razorpay' : _paymentMethod;
      final res = await context.read<CartService>().getDeliveryEstimate(_selectedAddressId!, paymentMethod: pmForApi);
      _estimate = res['estimate'];
      // Auto-switch off COD if backend says it's disabled / over limit
      if (_paymentMethod == 'cod' && _estimate != null) {
        final enabled = _estimate!['codEnabled'] != false;
        final maxAmt = (_estimate!['codMaxAmount'] ?? 0).toDouble();
        final cart = context.read<CartService>();
        if (!enabled || (maxAmt > 0 && cart.subtotal > maxAmt)) {
          _paymentMethod = 'online';
        }
      }
    } catch (e) {
      _error = e.toString();
    }
    if (mounted) setState(() => _loadingEstimate = false);
  }

  Future<void> _placeOrder() async {
    if (_selectedAddressId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a delivery address'), backgroundColor: AppColors.error),
      );
      return;
    }

    setState(() { _placing = true; _error = null; });
    try {
      final cart = context.read<CartService>();
      // Map UI value 'online' â†’ backend 'razorpay'
      final pmForApi = _paymentMethod == 'online' ? 'razorpay' : _paymentMethod;
      final res = await cart.placeOrder(
        addressId: _selectedAddressId!,
        paymentMethod: pmForApi,
        note: _noteController.text.trim(),
      );
      if (!mounted) return;
      if (res['success'] == true) {
        _pendingOrder = Map<String, dynamic>.from(res['order'] ?? {});
        if (pmForApi == 'razorpay') {
          await _startRazorpay(_pendingOrder!);
        } else {
          Navigator.pushReplacementNamed(context, '/order-success', arguments: _pendingOrder);
        }
      }
    } catch (e) {
      setState(() => _error = e.toString());
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/order-failed', arguments: e.toString());
      }
    }
    if (mounted) setState(() => _placing = false);
  }

  Future<void> _startRazorpay(Map<String, dynamic> order) async {
    try {
      final auth = context.read<AuthService>();
      final rz = await _api.post('/user/payments/create', {'orderId': order['_id']});
      if (!mounted) return;
      _razorpay!.open({
        'key': rz['key'],
        'amount': rz['amount'],
        'currency': rz['currency'] ?? 'INR',
        'order_id': rz['razorpayOrderId'],
        'name': 'DamnDeal',
        'description': 'Order ${order['orderNumber'] ?? ''}',
        'prefill': {
          'contact': auth.userPhone,
          'name': auth.userName,
        },
        'theme': {'color': '#7C3AED'},
      });
    } catch (e) {
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/order-failed', arguments: 'Could not open payment: $e');
      }
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse resp) async {
    try {
      await _api.post('/user/payments/verify', {
        'razorpayOrderId': resp.orderId,
        'razorpayPaymentId': resp.paymentId,
        'razorpaySignature': resp.signature,
      });
      if (!mounted) return;
      context.read<CartService>().clear();
      Navigator.pushReplacementNamed(context, '/order-success', arguments: _pendingOrder);
    } catch (e) {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/order-failed', arguments: 'Payment verification failed: $e');
    }
  }

  void _onPaymentError(PaymentFailureResponse resp) {
    if (!mounted) return;
    Navigator.pushReplacementNamed(
      context,
      '/order-failed',
      arguments: resp.message ?? 'Payment failed',
    );
  }

  void _onExternalWallet(ExternalWalletResponse resp) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('External wallet selected: ${resp.walletName ?? ''}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartService>();
    final isDdGo = cart.platform == 'ddgo';

    return isDdGo ? _buildDdGoCheckout(cart) : _buildDamnDealCheckout(cart);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  DD Go â€” Quick, single-page Zomato-style checkout
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildDdGoCheckout(CartService cart) {
    final deliveryFee = (_estimate?['deliveryFee'] ?? 0).toDouble();
    final platformFee = (_estimate?['platformFee'] ?? 0).toDouble();
    final codFee = (_paymentMethod == 'cod' ? (_estimate?['codFee'] ?? 0) : 0).toDouble();
    final grandTotal = cart.subtotal + deliveryFee + platformFee + codFee;
    final estMinutes = _estimate?['estimatedDeliveryMinutes'];
    final minOrder = (_estimate?['minOrderAmount'] ?? 0).toDouble();
    final belowMin = minOrder > 0 && cart.subtotal < minOrder;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: _ddgoGreen,
        foregroundColor: Colors.white,
        title: const Text('Quick Checkout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        elevation: 0,
      ),
      body: _loadingAddr
          ? const Center(child: CircularProgressIndicator(color: _ddgoGreen))
          : Column(
              children: [
                // Delivery time banner
                if (estMinutes != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    color: _ddgoGreen.withValues(alpha: 0.08),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.timer_rounded, size: 18, color: _ddgoGreen),
                        const SizedBox(width: 6),
                        Text(
                          'Delivery in $estMinutes mins',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _ddgoGreen,
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Delivery Address card
                        _sectionHeader('Deliver to', Icons.location_on_rounded, _ddgoGreen),
                        const SizedBox(height: 10),
                        if (_addresses.isEmpty)
                          _addAddressCard()
                        else
                          GestureDetector(
                            onTap: () => _showAddressPicker(),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: _ddgoGreen.withValues(alpha: 0.05),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: _ddgoGreen.withValues(alpha: 0.2)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: _ddgoGreen.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Icon(
                                      _selectedAddress?['label'] == 'Office' ? Icons.work_rounded : Icons.home_rounded,
                                      color: _ddgoGreen,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _selectedAddress?['label'] ?? 'Address',
                                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${_selectedAddress?['address'] ?? ''}, ${_selectedAddress?['city'] ?? ''}',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Text('Change', style: TextStyle(color: _ddgoGreen, fontWeight: FontWeight.w700, fontSize: 13)),
                                ],
                              ),
                            ),
                          ),
                        const SizedBox(height: 20),

                        // Items summary
                        _sectionHeader('Your Items', Icons.shopping_bag_rounded, _ddgoGreen),
                        const SizedBox(height: 10),
                        ...cart.items.map((item) => _ddgoItemRow(item)),

                        // Order note
                        const SizedBox(height: 16),
                        TextField(
                          controller: _noteController,
                          maxLines: 1,
                          decoration: InputDecoration(
                            hintText: 'Any instructions for delivery?',
                            prefixIcon: const Icon(Icons.note_alt_outlined, size: 20),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                        const SizedBox(height: 20),

                        //  Payment
                        _sectionHeader('Payment', Icons.payment_rounded, _ddgoGreen),
                        const SizedBox(height: 10),
                        _paymentOption('cod', 'Cash on Delivery', Icons.money_rounded),
                        const SizedBox(height: 8),
                        _paymentOption('online', 'Online Payment', Icons.account_balance_rounded),
                        const SizedBox(height: 20),

                        // Price breakdown
                        _priceSummaryCard(cart, deliveryFee, platformFee, codFee, grandTotal, _ddgoGreen),

                        // Minimum order warning
                        if (belowMin) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFFECACA)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.info_outline_rounded, color: AppColors.error, size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Minimum order value is ₹${minOrder.toStringAsFixed(0)}. Add ₹${(minOrder - cart.subtotal).toStringAsFixed(0)} more to place order.',
                                    style: const TextStyle(fontSize: 13, color: AppColors.error, fontWeight: FontWeight.w500),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
                        ],
                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
              ],
            ),
      bottomSheet: _addresses.isNotEmpty
          ? _ddgoBottomBar(grandTotal, belowMin)
          : null,
    );
  }

  Widget _ddgoItemRow(CartItem item) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _ddgoGreen.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('${item.quantity}x', style: const TextStyle(fontWeight: FontWeight.w700, color: _ddgoGreen, fontSize: 13)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(item.name, style: const TextStyle(fontSize: 14))),
          Text('₹${item.total.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _ddgoBottomBar(double grandTotal, bool belowMin) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, -4))],
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: (_placing || belowMin) ? null : _placeOrder,
            style: ElevatedButton.styleFrom(
              backgroundColor: belowMin ? Colors.grey : _ddgoGreen,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _placing
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Pay ₹${grandTotal.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward_rounded, size: 20, color: Colors.white),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  DamnDeal â€” single-page Flipkart-style checkout
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _buildDamnDealCheckout(CartService cart) {
    final deliveryFee = (_estimate?['deliveryFee'] ?? 0).toDouble();
    final platformFee = (_estimate?['platformFee'] ?? 0).toDouble();
    final codFee = (_paymentMethod == 'cod' ? (_estimate?['codFee'] ?? 0) : 0).toDouble();
    final grandTotal = cart.subtotal + deliveryFee + platformFee + codFee;
    final minOrder = (_estimate?['minOrderAmount'] ?? 0).toDouble();
    final belowMin = minOrder > 0 && cart.subtotal < minOrder;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F3F6),
      appBar: AppBar(
        elevation: 0.5,
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Checkout',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text(
              '${cart.items.length} ${cart.items.length == 1 ? "item" : "items"}  ·  ₹${cart.subtotal.toStringAsFixed(0)}',
              style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textMuted),
            ),
          ],
        ),
      ),
      body: _loadingAddr
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(0, 8, 0, 100),
              children: [
                _ddSection(label: 'DELIVERY ADDRESS', child: _ddAddressBlock()),
                const SizedBox(height: 8),
                _ddSection(label: 'ORDER SUMMARY', child: _ddOrderSummary(cart)),
                const SizedBox(height: 8),
                _ddSection(label: 'PAYMENT METHOD', child: _ddPaymentBlock()),
                const SizedBox(height: 8),
                _ddSection(
                  label: 'DELIVERY INSTRUCTIONS (OPTIONAL)',
                  child: TextField(
                    controller: _noteController,
                    maxLines: 2,
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'e.g. Leave at the door',
                      hintStyle: const TextStyle(
                          fontSize: 12.5, color: AppColors.textMuted),
                      isDense: true,
                      contentPadding: const EdgeInsets.all(10),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(6),
                          borderSide:
                              const BorderSide(color: Color(0xFFD8D8D8))),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(6),
                          borderSide:
                              const BorderSide(color: Color(0xFFD8D8D8))),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(6),
                          borderSide:
                              const BorderSide(color: AppColors.primary)),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                _ddSection(
                  label: 'PRICE DETAILS',
                  child: _ddPriceDetails(
                      cart, deliveryFee, platformFee, codFee, grandTotal),
                ),
                if (belowMin) ...[
                  const SizedBox(height: 8),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF4E5),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFF6CC8A)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded,
                            size: 16, color: Color(0xFFB76E00)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Minimum order ₹${minOrder.toStringAsFixed(0)}. Add ₹${(minOrder - cart.subtotal).toStringAsFixed(0)} more.',
                            style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF8A4F00),
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Text(_error!,
                        style: const TextStyle(
                            color: AppColors.error, fontSize: 12.5)),
                  ),
                ],
              ],
            ),
      bottomSheet: _ddBottomBar(grandTotal, belowMin),
    );
  }

  Widget _ddSection({required String label, required Widget child}) {
    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                  color: Colors.grey.shade700)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _ddAddressBlock() {
    if (_addresses.isEmpty) {
      return InkWell(
        onTap: () async {
          await Navigator.pushNamed(context, '/add-address');
          _loadAddresses();
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFD8D8D8)),
            borderRadius: BorderRadius.circular(6),
          ),
          child: const Row(
            children: [
              Icon(Icons.add_location_alt_outlined,
                  size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Add a delivery address',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      fontSize: 13)),
            ],
          ),
        ),
      );
    }

    final a = _selectedAddress ?? _addresses.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(3),
              ),
              child: Text((a['label'] ?? 'Home').toString().toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.grey.shade700,
                      letterSpacing: 0.4)),
            ),
            if ((a['name'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(width: 8),
              Expanded(
                child: Text('${a['name']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700)),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        Text(
          '${a['address'] ?? ''}, ${a['city'] ?? ''} - ${a['pincode'] ?? ''}',
          style: const TextStyle(
              fontSize: 12.5,
              height: 1.4,
              color: AppColors.textSecondary),
        ),
        if ((a['phone'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('Phone: ${a['phone']}',
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
        ],
        const SizedBox(height: 10),
        Row(
          children: [
            _ddTextBtn('CHANGE', _openAddressPicker),
            const SizedBox(width: 16),
            _ddTextBtn('ADD NEW', () async {
              await Navigator.pushNamed(context, '/add-address');
              _loadAddresses();
            }),
          ],
        ),
      ],
    );
  }

  Future<void> _openAddressPicker() async {
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
      ),
      builder: (ctx) {
        return SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                child: Row(
                  children: [
                    const Text('Select Address',
                        style:
                            TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _addresses.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, color: Color(0xFFEFEFEF)),
                  itemBuilder: (_, i) {
                    final a = _addresses[i];
                    final selected = a['_id'] == _selectedAddressId;
                    return InkWell(
                      onTap: () {
                        setState(() {
                          _selectedAddressId = a['_id'];
                          _selectedAddress = Map<String, dynamic>.from(a);
                        });
                        _getEstimate();
                        Navigator.pop(ctx);
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              selected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                              color: selected
                                  ? AppColors.primary
                                  : AppColors.textMuted,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(a['label'] ?? 'Address',
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${a['address'] ?? ''}, ${a['city'] ?? ''} - ${a['pincode'] ?? ''}',
                                    style: const TextStyle(
                                        fontSize: 12.5,
                                        height: 1.4,
                                        color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _ddOrderSummary(CartService cart) {
    return Column(
      children: cart.items.map((it) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Text('${it.quantity}Ã—',
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(it.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                        height: 1.35)),
              ),
              const SizedBox(width: 8),
              Text('₹${it.total.toStringAsFixed(0)}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _ddPaymentBlock() {
    return Column(
      children: [
        _ddPayTile(
          value: 'cod',
          icon: Icons.payments_outlined,
          title: 'Cash on Delivery',
          subtitle: 'Pay when your order is delivered',
        ),
        const Divider(height: 1, color: Color(0xFFEFEFEF)),
        _ddPayTile(
          value: 'online',
          icon: Icons.account_balance_wallet_outlined,
          title: 'UPI / Cards / Net Banking',
          subtitle: 'Pay securely via Razorpay',
        ),
      ],
    );
  }

  Widget _ddPayTile({
    required String value,
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    final selected = _paymentMethod == value;
    final isCod = value == 'cod';
    final codEnabled = _estimate == null ? true : (_estimate!['codEnabled'] != false);
    final codMax = (_estimate?['codMaxAmount'] ?? 0).toDouble();
    final cartSubtotal = context.read<CartService>().subtotal;
    final codTooBig = codMax > 0 && cartSubtotal > codMax;
    final disabled = isCod && (!codEnabled || codTooBig);
    final effectiveSubtitle = disabled
        ? (!codEnabled ? 'Cash on Delivery is currently unavailable' : 'Not available for orders above ₹${codMax.toStringAsFixed(0)}')
        : subtitle;
    return Opacity(
      opacity: disabled ? 0.5 : 1.0,
      child: InkWell(
        onTap: disabled ? null : () { setState(() => _paymentMethod = value); _getEstimate(); },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? AppColors.primary : AppColors.textMuted,
              size: 20,
            ),
            const SizedBox(width: 10),
            Icon(icon, size: 20, color: Colors.grey.shade700),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(effectiveSubtitle,
                      style: TextStyle(
                          fontSize: 11.5, color: disabled ? AppColors.error : AppColors.textMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  Widget _ddPriceDetails(
      CartService cart, double deliveryFee, double platformFee, double codFee, double total) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ddRow('Item Total', '₹${cart.subtotal.toStringAsFixed(0)}'),
        if (_loadingEstimate)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: SizedBox(
                height: 14,
                width: 14,
                child: CircularProgressIndicator(strokeWidth: 1.5)),
          )
        else ...[
          _ddRow(
            'Delivery Fee',
            _estimate?['freeDeliveryApplied'] == true
                ? 'FREE'
                : '₹${deliveryFee.toStringAsFixed(0)}',
            valueColor: _estimate?['freeDeliveryApplied'] == true
                ? AppColors.success
                : null,
          ),
          if (platformFee > 0)
            _ddRow('Platform Fee', '₹${platformFee.toStringAsFixed(0)}'),
          if (codFee > 0)
            _ddRow('COD Handling Fee', '₹${codFee.toStringAsFixed(0)}'),
        ],
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: DashedDivider(),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('To Pay',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
            Text('₹${total.toStringAsFixed(0)}',
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
          ],
        ),
      ],
    );
  }

  Widget _ddRow(String l, String v, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(l,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
          Text(v,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: valueColor ?? AppColors.textPrimary)),
        ],
      ),
    );
  }

  Widget _ddTextBtn(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Text(label,
            style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: AppColors.primary)),
      ),
    );
  }

  Widget _ddBottomBar(double total, bool belowMin) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE6E6E6))),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('₹${total.toStringAsFixed(0)}',
                        style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary)),
                    Text(
                        _paymentMethod == 'cod'
                            ? 'Pay on Delivery'
                            : 'Pay Online · Secure',
                        style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade600,
                            letterSpacing: 0.4)),
                  ],
                ),
              ),
              SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed:
                      (_placing || belowMin || _selectedAddressId == null)
                          ? null
                          : _placeOrder,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    disabledBackgroundColor: Colors.grey.shade300,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                  icon: _placing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.lock_outline_rounded, size: 16),
                  label: Text(
                      belowMin
                          ? 'Min ₹${(_estimate?['minOrderAmount'] ?? 0).toStringAsFixed(0)}'
                          : 'Place Order',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  //  Shared widgets
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Widget _sectionHeader(String title, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }

  Widget _addAddressCard() {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.add_location_alt_outlined, color: AppColors.primary),
        title: const Text('Add delivery address'),
        onTap: () async {
          await Navigator.pushNamed(context, '/add-address');
          _loadAddresses();
        },
      ),
    );
  }

  Widget _paymentOption(String value, String label, IconData icon) {
    final selected = _paymentMethod == value;
    final isCod = value == 'cod';
    final codEnabled = _estimate == null ? true : (_estimate!['codEnabled'] != false);
    final codMax = (_estimate?['codMaxAmount'] ?? 0).toDouble();
    final cartSubtotal = context.read<CartService>().subtotal;
    final codTooBig = codMax > 0 && cartSubtotal > codMax;
    final disabled = isCod && (!codEnabled || codTooBig);
    final disabledMsg = !codEnabled
        ? 'Cash on Delivery is currently unavailable'
        : (codTooBig ? 'Not available for orders above ₹${codMax.toStringAsFixed(0)}' : '');
    return Opacity(
      opacity: disabled ? 0.5 : 1.0,
      child: GestureDetector(
        onTap: disabled ? null : () {
          setState(() => _paymentMethod = value);
          _getEstimate();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? _ddgoGreen : AppColors.border, width: selected ? 2 : 1),
            color: selected ? _ddgoGreen.withValues(alpha: 0.05) : Colors.white,
          ),
          child: Row(
            children: [
              Icon(icon, color: selected ? _ddgoGreen : AppColors.textMuted, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? _ddgoGreen : AppColors.textPrimary)),
                    if (disabled && disabledMsg.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(disabledMsg, style: const TextStyle(fontSize: 11, color: AppColors.error)),
                      ),
                  ],
                ),
              ),
              if (selected)
                const Icon(Icons.check_circle_rounded, color: _ddgoGreen, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _priceSummaryCard(CartService cart, double deliveryFee, double platformFee, double codFee, double grandTotal, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Bill Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          _priceRow('Item Total', '₹${cart.subtotal.toStringAsFixed(0)}'),
          if (_loadingEstimate)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 1.5))),
            )
          else ...[
            _priceRow('Delivery Fee', _estimate?['freeDeliveryApplied'] == true ? 'FREE' : '₹${deliveryFee.toStringAsFixed(0)}'),
            _priceRow('Platform Fee', '₹${platformFee.toStringAsFixed(0)}'),
            if (codFee > 0) _priceRow('COD Handling Fee', '₹${codFee.toStringAsFixed(0)}'),
          ],
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('To Pay', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              Text('₹${grandTotal.toStringAsFixed(0)}',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: accentColor)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _priceRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14,
              color: value == 'FREE' ? AppColors.success : AppColors.textPrimary)),
        ],
      ),
    );
  }

  void _showAddressPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.8,
        expand: false,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Select Address', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: scrollCtrl,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  ..._addresses.map((a) {
                    final selected = a['_id'] == _selectedAddressId;
                    return InkWell(
                      onTap: () {
                        setState(() {
                          _selectedAddressId = a['_id'];
                          _selectedAddress = Map<String, dynamic>.from(a);
                        });
                        _getEstimate();
                        Navigator.pop(ctx);
                      },
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(
                              color: selected
                                  ? AppColors.primary
                                  : const Color(0xFFE0E0E0),
                              width: selected ? 1.5 : 1),
                          borderRadius: BorderRadius.circular(10),
                          color: selected
                              ? AppColors.primaryLight.withValues(alpha: 0.3)
                              : Colors.white,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              selected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                              color: selected
                                  ? AppColors.primary
                                  : AppColors.textMuted,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(a['label'] ?? 'Address',
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${a['address'] ?? ''}, ${a['city'] ?? ''} - ${a['pincode'] ?? ''}',
                                    style: const TextStyle(
                                        fontSize: 12.5,
                                        height: 1.4,
                                        color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await Navigator.pushNamed(context, '/add-address');
                      _loadAddresses();
                    },
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('Add new address'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
