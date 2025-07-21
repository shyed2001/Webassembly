#include <CL/cl.h>
#include <stdio.h>
int main() {
    cl_platform_id platform;
    cl_device_id device;
    cl_uint num_platforms, num_devices;
    cl_int err = clGetPlatformIDs(1, &platform, &num_platforms);
    if (err != CL_SUCCESS) { printf("Error getting platform: %d\n", err); return 1; }
    err = clGetDeviceIDs(platform, CL_DEVICE_TYPE_GPU, 1, &device, &num_devices);
    if (err != CL_SUCCESS) { printf("Error getting device: %d\n", err); return 1; }
    char version[128];
    clGetDeviceInfo(device, CL_DEVICE_OPENCL_C_VERSION, sizeof(version), version, NULL);
    printf("OpenCL C Version: %s\n", version);
    return 0;
}