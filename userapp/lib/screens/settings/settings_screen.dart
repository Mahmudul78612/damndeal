import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        children: [
          // User profile card
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  child: Text(
                    auth.userName.isNotEmpty ? auth.userName[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(auth.userName.isNotEmpty ? auth.userName : 'Guest',
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(auth.userPhone,
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Menu items
          _menuSection('Orders & Activity', [
            _menuItem(Icons.receipt_long_rounded, 'My Orders', () => Navigator.pushNamed(context, '/orders')),
            _menuItem(Icons.account_balance_wallet_rounded, 'Wallet', () => Navigator.pushNamed(context, '/wallet')),
            _menuItem(Icons.favorite_outline_rounded, 'Wishlist', () {}),
            _menuItem(Icons.card_giftcard_rounded, 'Refer & Earn', () {}),
          ]),

          _menuSection('Support', [
            _menuItem(Icons.headset_mic_rounded, 'Help & Support', () {}),
            _menuItem(Icons.assignment_return_outlined, 'Returns', () {}),
          ]),

          _menuSection('Legal', [
            _menuItem(Icons.description_outlined, 'Terms & Conditions', () => Navigator.pushNamed(context, '/legal', arguments: 'terms')),
            _menuItem(Icons.privacy_tip_outlined, 'Privacy Policy', () => Navigator.pushNamed(context, '/legal', arguments: 'privacy')),
            _menuItem(Icons.gavel_rounded, 'Refund Policy', () => Navigator.pushNamed(context, '/legal', arguments: 'refund')),
          ]),

          const SizedBox(height: 12),

          // Logout
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Logout'),
                    content: const Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Logout', style: TextStyle(color: AppColors.error)),
                      ),
                    ],
                  ),
                );
                if (confirm == true) {
                  await auth.logout();
                  if (context.mounted) Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
                }
              },
              icon: const Icon(Icons.logout_rounded, color: AppColors.error),
              label: const Text('Logout', style: TextStyle(color: AppColors.error)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.error),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),

          const SizedBox(height: 24),
          Center(
            child: Text('DamnDeal v1.0.0',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _menuSection(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        ),
        ...items,
      ],
    );
  }

  Widget _menuItem(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary, size: 22),
      title: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
      onTap: onTap,
      dense: true,
    );
  }
}
