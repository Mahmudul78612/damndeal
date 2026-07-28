import 'package:flutter/material.dart';
import 'api_service.dart';

class CartItem {
  final String productId;
  final String name;
  final String? image;
  final double price;
  final String unit;
  final String partnerId;
  final String partnerName;
  final String platform; // 'ddgo' or 'damndeal'
  final String? variantLabel; // e.g. "S", "M", "1kg"
  int quantity;

  CartItem({
    required this.productId,
    required this.name,
    this.image,
    required this.price,
    required this.unit,
    required this.partnerId,
    required this.partnerName,
    this.platform = 'damndeal',
    this.variantLabel,
    this.quantity = 1,
  });

  // Unique key: variant products get separate cart slots per variant
  String get cartKey => variantLabel != null ? '$productId:$variantLabel' : productId;

  double get total => price * quantity;
}

class CartService extends ChangeNotifier {
  final ApiService _api = ApiService();
  final List<CartItem> _items = [];

  List<CartItem> get items => List.unmodifiable(_items);
  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);

  double get subtotal => _items.fold(0, (sum, item) => sum + item.total);

  String? get partnerId => _items.isNotEmpty ? _items.first.partnerId : null;
  String? get partnerName => _items.isNotEmpty ? _items.first.partnerName : null;
  String? get platform => _items.isNotEmpty ? _items.first.platform : null;

  bool get isEmpty => _items.isEmpty;

  // DD Go specific getters
  List<CartItem> get ddgoItems => _items.where((i) => i.platform == 'ddgo').toList();
  int get ddgoItemCount => ddgoItems.fold(0, (sum, item) => sum + item.quantity);
  double get ddgoSubtotal => ddgoItems.fold(0, (sum, item) => sum + item.total);
  bool get hasDdgoItems => ddgoItems.isNotEmpty;

  // DamnDeal specific getters
  List<CartItem> get damndealItems => _items.where((i) => i.platform == 'damndeal').toList();
  int get damndealItemCount => damndealItems.fold(0, (sum, item) => sum + item.quantity);
  double get damndealSubtotal => damndealItems.fold(0, (sum, item) => sum + item.total);

  void addItem(CartItem item) {
    // Only allow items from one partner at a time
    if (_items.isNotEmpty && _items.first.partnerId != item.partnerId) {
      _items.clear();
    }

    final idx = _items.indexWhere((i) => i.cartKey == item.cartKey);
    if (idx >= 0) {
      _items[idx].quantity++;
    } else {
      _items.add(item);
    }
    notifyListeners();
  }

  void removeItem(String productId, {String? variantLabel}) {
    final key = variantLabel != null ? '$productId:$variantLabel' : productId;
    _items.removeWhere((i) => i.cartKey == key);
    notifyListeners();
  }

  void updateQuantity(String productId, int qty, {String? variantLabel}) {
    final key = variantLabel != null ? '$productId:$variantLabel' : productId;
    final idx = _items.indexWhere((i) => i.cartKey == key);
    if (idx >= 0) {
      if (qty <= 0) {
        _items.removeAt(idx);
      } else {
        _items[idx].quantity = qty;
      }
      notifyListeners();
    }
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }

  int getQuantity(String productId, {String? variantLabel}) {
    final key = variantLabel != null ? '$productId:$variantLabel' : productId;
    final idx = _items.indexWhere((i) => i.cartKey == key);
    return idx >= 0 ? _items[idx].quantity : 0;
  }

  Future<Map<String, dynamic>> getDeliveryEstimate(String addressId, {String paymentMethod = 'cod'}) async {
    return await _api.get('/user/orders/delivery-estimate', query: {
      'partnerId': partnerId!,
      'addressId': addressId,
      'subtotal': subtotal.toString(),
      'platform': platform ?? 'damndeal',
      'paymentMethod': paymentMethod,
    });
  }

  Future<Map<String, dynamic>> placeOrder({
    required String addressId,
    double discount = 0,
    String paymentMethod = 'cod',
    String? note,
  }) async {
    final body = <String, dynamic>{
      'partnerId': partnerId,
      'platform': platform ?? 'damndeal',
      'items': _items.map((i) => {
        'product': i.productId,
        'quantity': i.quantity,
        if (i.variantLabel != null) 'variantLabel': i.variantLabel,
      }).toList(),
      'addressId': addressId,
      'discount': discount,
      'paymentMethod': paymentMethod,
    };
    if (note != null && note.isNotEmpty) body['note'] = note;

    final res = await _api.post('/user/orders', body);
    if (res['success'] == true && paymentMethod == 'cod') {
      clear();
    }
    return res;
  }
}
