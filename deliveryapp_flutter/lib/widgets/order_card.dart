import 'package:flutter/material.dart';
import '../theme.dart';

class OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback onTap;

  const OrderCard({super.key, required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final addr = order['deliveryAddress'] ?? order['address'] ?? {};
    final addrText = addr['street'] ?? addr['fullAddress'] ?? addr['addressLine'] ?? 'Address N/A';
    final items = (order['items'] as List?)?.length ?? 0;
    final ds = (order['deliveryStatus'] ?? order['status'] ?? 'pending') as String;
    final orderNum = order['orderNumber'] ?? (order['_id'] as String?)?.substring((order['_id'] as String).length - 6) ?? '';

    return GestureDetector(
      onTap: onTap,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('#$orderNum', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  _badge(ds),
                ],
              ),
              const SizedBox(height: 8),
              // Address
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on, size: 16, color: AppTheme.textLight),
                  const SizedBox(width: 6),
                  Expanded(child: Text(addrText, style: const TextStyle(fontSize: 12, color: AppTheme.textLight), maxLines: 2, overflow: TextOverflow.ellipsis)),
                ],
              ),
              const SizedBox(height: 8),
              // Meta row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('$items item${items != 1 ? 's' : ''} · ${order['paymentMethod'] ?? '—'}',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textLight)),
                  Text('₹${order['totalAmount'] ?? order['grandTotal'] ?? 0}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.primary)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.statusBgColor(status),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.statusColor(status)),
      ),
    );
  }
}
