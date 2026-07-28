import 'package:flutter/material.dart';

class SwipeButton extends StatefulWidget {
  final String text;
  final IconData icon;
  final Color color;
  final VoidCallback onComplete;

  const SwipeButton({
    super.key,
    required this.text,
    required this.icon,
    required this.color,
    required this.onComplete,
  });

  @override
  State<SwipeButton> createState() => _SwipeButtonState();
}

class _SwipeButtonState extends State<SwipeButton> {
  double _dragX = 0;
  bool _completed = false;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxDrag = constraints.maxWidth - 60;

        return Container(
          height: 56,
          margin: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: widget.color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(28),
          ),
          child: Stack(
            children: [
              // Fill
              Positioned(
                left: 0, top: 0, bottom: 0,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 100),
                  width: _dragX + 56,
                  decoration: BoxDecoration(
                    color: widget.color.withValues(alpha: _completed ? 1.0 : 0.3),
                    borderRadius: BorderRadius.circular(28),
                  ),
                ),
              ),
              // Text
              Center(
                child: Text(
                  _completed ? '✓ Done' : widget.text,
                  style: TextStyle(
                    color: widget.color.withValues(alpha: _completed ? 1.0 : 0.6),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              // Thumb
              Positioned(
                left: _dragX + 4,
                top: 4,
                child: GestureDetector(
                  onHorizontalDragUpdate: _completed
                      ? null
                      : (details) {
                          setState(() {
                            _dragX = (_dragX + details.delta.dx).clamp(0.0, maxDrag);
                          });
                        },
                  onHorizontalDragEnd: _completed
                      ? null
                      : (details) {
                          if (_dragX >= maxDrag * 0.85) {
                            setState(() { _dragX = maxDrag; _completed = true; });
                            widget.onComplete();
                          } else {
                            setState(() => _dragX = 0);
                          }
                        },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 100),
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: _completed ? widget.color : Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 6, offset: const Offset(0, 2)),
                      ],
                    ),
                    child: Icon(
                      _completed ? Icons.check : widget.icon,
                      color: _completed ? Colors.white : widget.color,
                      size: 22,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
