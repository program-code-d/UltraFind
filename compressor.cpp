#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <math.h>

// --- HIGH VELOCITY CONFIG ---
// Strength of the "Squeeze" (2 = Light, 4 = Heavy, 8 = Extreme)
#define SQUEEZE 4 

#pragma pack(push, 1)
struct BMP_HEAD {
    uint16_t type;      // Magic "BM"
    uint32_t size;      // Total file size
    uint32_t reserved;
    uint32_t offset;    // Start of pixel data
    uint32_t dib_size;  // Info header size (40)
    int32_t  w, h;      // Width and Height
    uint16_t planes;    // 1
    uint16_t bpp;       // 8 bits per pixel
    uint32_t comp;      // 0 (none)
    uint32_t img_size;  // Size of pixel data
    int32_t  x_ppm, y_ppm;
    uint32_t colors, imp_colors;
};
#pragma pack(pop)

int main(int argc, char* argv[]) {
    if (argc < 3) return 1;

    // 1. OPEN INPUT
    FILE* fin = fopen(argv[1], "rb");
    if (!fin) return 1;

    fseek(fin, 0, SEEK_END);
    long f_size = ftell(fin);
    fseek(fin, 0, SEEK_SET);

    // 2. CALCULATE DIMENSIONS
    int32_t dim = (int32_t)sqrt((double)f_size);
    if (dim < 1) { fclose(fin); return 1; }

    uint8_t* pixels = (uint8_t*)malloc(dim * dim);
    if (!pixels) { fclose(fin); return 1; }
    fread(pixels, 1, dim * dim, fin);
    fclose(fin);

    // 3. THE SQUEEZE ENGINE (Clear-Vision Logic)
    // This is incredibly fast and prevents the "static" noise
    for (int i = 0; i < (dim * dim); i++) {
        // Quantization: Groups colors together to save data entropy
        pixels[i] = (pixels[i] / SQUEEZE) * SQUEEZE;
    }

    // 4. BROWSER-READY WRITER
    FILE* fout = fopen(argv[2], "wb");
    if (!fout) { free(pixels); return 1; }

    // BMP rows MUST be multiples of 4 bytes (The "Browser Fix")
    int padded_w = (dim + 3) & ~3;
    uint32_t pixel_data_size = padded_w * dim;

    struct BMP_HEAD h = {0};
    h.type = 0x4D42; // "BM"
    h.offset = sizeof(struct BMP_HEAD) + 1024; // Header + Palette
    h.size = h.offset + pixel_data_size;
    h.dib_size = 40;
    h.w = dim;
    h.h = dim;
    h.planes = 1;
    h.bpp = 8;
    h.img_size = pixel_data_size;
    h.colors = 256;
    h.imp_colors = 256;

    fwrite(&h, sizeof(h), 1, fout);

    // Write Grayscale Palette (Required for browsers to render 8-bit images)
    for (int i = 0; i < 256; i++) {
        uint8_t color[4] = {(uint8_t)i, (uint8_t)i, (uint8_t)i, 0};
        fwrite(color, 4, 1, fout);
    }

    // Write Pixel Rows (BMPs are stored bottom-to-top)
    uint8_t padding[4] = {0,0,0,0};
    int pad_len = padded_w - dim;
    for (int y = dim - 1; y >= 0; y--) {
        fwrite(&pixels[y * dim], 1, dim, fout);
        if (pad_len > 0) fwrite(padding, 1, pad_len, fout);
    }

    fclose(fout);
    free(pixels);
    printf("Successfully Squeezed: %s\n", argv[2]);
    return 0;
}