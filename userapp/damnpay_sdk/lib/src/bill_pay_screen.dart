import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'models.dart';

/// Bill Pay screen shown inside partner apps via the SDK
class DamnPayBillPayScreen extends StatefulWidget {
  final DamnPaySession session;
  final String baseUrl;

  const DamnPayBillPayScreen({
    super.key,
    required this.session,
    required this.baseUrl,
  });

  @override
  State<DamnPayBillPayScreen> createState() => _DamnPayBillPayScreenState();
}

class _DamnPayBillPayScreenState extends State<DamnPayBillPayScreen> {
  Map<String, List<DamnPayService>> _services = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadServices();
  }

  Future<void> _loadServices() async {
    try {
      final response = await http.get(
        Uri.parse('${widget.baseUrl}/sdk/services'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.session.token}',
        },
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to load services');
      }

      final data = jsonDecode(response.body);
      final services = <String, List<DamnPayService>>{};
      final raw = data['services'] as Map<String, dynamic>;
      for (final entry in raw.entries) {
        services[entry.key] = (entry.value as List)
            .map((item) => DamnPayService.fromJson(item as Map<String, dynamic>))
            .toList();
      }

      if (mounted) {
        setState(() {
          _services = services;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  IconData _getIcon(String iconName) {
    switch (iconName) {
      case 'phone_android':
        return Icons.phone_android;
      case 'phone_iphone':
        return Icons.phone_iphone;
      case 'tv':
        return Icons.tv;
      case 'bolt':
        return Icons.bolt;
      case 'water_drop':
        return Icons.water_drop;
      case 'local_gas_station':
        return Icons.local_gas_station;
      case 'wifi':
        return Icons.wifi;
      case 'call':
        return Icons.call;
      case 'propane_tank':
        return Icons.propane_tank;
      case 'location_city':
        return Icons.location_city;
      case 'home':
        return Icons.home;
      case 'train':
        return Icons.train;
      case 'credit_card':
        return Icons.credit_card;
      default:
        return Icons.payment;
    }
  }

  String _categoryLabel(String key) {
    switch (key) {
      case 'recharge':
        return 'Recharges';
      case 'billpay':
        return 'Bill Payments';
      case 'metro':
        return 'Metro';
      case 'creditcard':
        return 'Credit Card';
      default:
        return key;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay Bills & Recharge'),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                'Powered by DamnPay',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline,
                          size: 48, color: theme.colorScheme.error),
                      const SizedBox(height: 12),
                      Text('Failed to load services',
                          style: theme.textTheme.bodyLarge),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () {
                          setState(() {
                            _loading = true;
                            _error = null;
                          });
                          _loadServices();
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: _services.entries.map((entry) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12, top: 8),
                          child: Text(
                            _categoryLabel(entry.key),
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        GridView.count(
                          crossAxisCount: 3,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.95,
                          children: entry.value.map((service) {
                            return _ServiceCard(
                              service: service,
                              icon: _getIcon(service.icon),
                              onTap: () => _onServiceTap(service),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 8),
                      ],
                    );
                  }).toList(),
                ),
    );
  }

  void _onServiceTap(DamnPayService service) {
    // Open the specific service in a WebView or native screen
    // For now, show a coming soon message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Opening ${service.name}...')),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final DamnPayService service;
  final IconData icon;
  final VoidCallback onTap;

  const _ServiceCard({
    required this.service,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFE91E8C)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(height: 8),
            Text(
              service.name,
              style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
