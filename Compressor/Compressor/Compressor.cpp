#define _CRT_SECURE_NO_WARNINGS // Fixes Visual Studio "Unsafe" errors
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <math.h>

// --- HIGH VELOCITY SETTINGS ---
#define SHIFT 3 // The "Squeeze" intensity

#pragma pack(push, 1)
struct BMP_FILE {
    uint16_t bfType;
    uint32_t bfSize;
    uint16_t bfRes1;
    uint16_t bfRes2;
    uint32_t bfOffBits;
    uint32_t biSize;
    int32_t  biWidth;
    int32_t  biHeight;
    uint16_t biPlanes;
    uint16_t biBitCount;
    uint32_t biCompression;
    uint32_t biSizeImage;
    int32_t  biXPelsPerMeter;
    int32_t  biYPelsPerMeter;
    uint32_t biClrUsed;
    uint32_t biClrImportant;
};
#pragma pack(pop)

// Fast In-Place Transform
static inline void velocity_transform(uint8_t* b) {
    for (int i = 0; i < 8; i += 2) {
        uint8_t x = b[i];
        uint8_t y = b[i + 1];
        b[i] = (x + y) >> 1;
        b[i + 1] = (x - y) >> 1;
    }
}

int main(int argc, char* argv[]) {
    const char* in_name = (argc > 1) ? argv[1] : "input.bin";
    const char* out_name = (argc > 2) ? argv[2] : "output.bmp";

    FILE* f = fopen(in_name, "rb");
    uint8_t* data = NULL;
    size_t size = 0;

    if (!f) {
        // Auto-generate data if file is missing (so it always works)
        size = 512 * 512;
        data = (uint8_t*)malloc(size);
        for (size_t i = 0; i < size; i++) data[i] = (uint8_t)(i ^ (i / 512));
    }
    else {
        fseek(f, 0, SEEK_END);
        size = (size_t)ftell(f);
        fseek(f, 0, SEEK_SET);
        data = (uint8_t*)malloc(size);
        if (data) fread(data, 1, size, f);
        fclose(f);
    }

    if (!data) return 1;

    int32_t dim = (int32_t)sqrt((double)size);
    int32_t padded_w = (dim + 3) & ~3; // Force 4-byte alignment for browsers

    // --- THE ENGINE LOOP (DPCM + SQUEEZE) ---
    uint8_t last = 128;
    for (int32_t i = 0; i < (dim * dim); i++) {
        int32_t delta = data[i] - last;
        data[i] = (uint8_t)(last + ((delta >> SHIFT) << SHIFT));
        last = data[i];
        if ((i & 7) == 0) velocity_transform(&data[i]);
    }

    // --- BROWSER-COMPLIANT WRITE ---
    FILE* out = fopen(out_name, "wb");
    if (!out) return 1;

    struct BMP_FILE h = { 0 };
    h.bfType = 0x4D42;
    h.bfOffBits = sizeof(struct BMP_FILE) + 1024;
    h.bfSize = h.bfOffBits + (padded_w * dim);
    h.biSize = 40;
    h.biWidth = dim;
    h.biHeight = dim;
    h.biPlanes = 1;
    h.biBitCount = 8;
    h.biSizeImage = padded_w * dim;
    h.biClrUsed = 256;
    h.biClrImportant = 256;

    fwrite(&h, sizeof(h), 1, out);

    // Grayscale Palette
    for (int i = 0; i < 256; i++) {
        uint8_t p[4] = { (uint8_t)i, (uint8_t)i, (uint8_t)i, 0 };
        fwrite(p, 4, 1, out);
    }

    // Padded Data Write
    uint8_t pad[4] = { 0,0,0,0 };
    int p_len = padded_w - dim;
    for (int y = dim - 1; y >= 0; y--) {
        fwrite(&data[y * dim], 1, dim, out);
        if (p_len > 0) fwrite(pad, 1, p_len, out);
    }

    fclose(out);
    free(data);
    printf("ENGINE COMPLETE: %s created.\n", out_name);
    return 0;
}