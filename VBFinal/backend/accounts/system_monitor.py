import time
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

@csrf_exempt
@require_http_methods(["GET"])
def get_system_stats(request):
    """Get real-time system statistics"""
    try:
        if not PSUTIL_AVAILABLE:
            # Return mock data if psutil is not available
            return JsonResponse({
                'cpu': 45.2,
                'memory': 67.8,
                'disk': 23.1,
                'network_sent': 125.4,
                'network_recv': 89.7,
                'uptime_hours': 72.5,
                'process_count': 156,
                'timestamp': time.time(),
                'mock': True
            })
        
        # CPU Usage
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory Usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # Disk Usage
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        
        # Network I/O
        network = psutil.net_io_counters()
        
        # System Info
        boot_time = psutil.boot_time()
        uptime = time.time() - boot_time
        
        # Process Count
        process_count = len(psutil.pids())
        
        return JsonResponse({
            'cpu': round(cpu_percent, 1),
            'memory': round(memory_percent, 1),
            'disk': round(disk_percent, 1),
            'network_sent': round(network.bytes_sent / (1024*1024), 2),  # MB
            'network_recv': round(network.bytes_recv / (1024*1024), 2),  # MB
            'uptime_hours': round(uptime / 3600, 1),
            'process_count': process_count,
            'timestamp': time.time(),
            'mock': False
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
