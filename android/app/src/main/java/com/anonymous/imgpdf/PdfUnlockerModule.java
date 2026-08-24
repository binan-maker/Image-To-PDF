package com.anonymous.imgpdf;

import android.content.ContentResolver;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;

import java.io.File;
import java.io.InputStream;

public class PdfUnlockerModule extends ReactContextBaseJavaModule {
  public PdfUnlockerModule(ReactApplicationContext context) {
    super(context);
    PDFBoxResourceLoader.init(context);
  }

  @NonNull
  @Override
  public String getName() {
    return "PdfUnlocker";
  }

  @ReactMethod
  public void unlockPdf(String sourceUri, String password, Promise promise) {
    new Thread(() -> {
      PDDocument document = null;
      try {
        ContentResolver resolver = getReactApplicationContext().getContentResolver();
        InputStream input = resolver.openInputStream(Uri.parse(sourceUri));
        if (input == null) throw new IllegalStateException("Could not open selected PDF");

        document = (password == null || password.isEmpty())
            ? PDDocument.load(input)
            : PDDocument.load(input, password);
        document.setAllSecurityToBeRemoved(true);

        File output = File.createTempFile("unlocked-", ".pdf",
            getReactApplicationContext().getCacheDir());
        document.save(output);
        promise.resolve(Uri.fromFile(output).toString());
      } catch (Exception error) {
        promise.reject("PDF_UNLOCK_FAILED", error.getMessage(), error);
      } finally {
        if (document != null) {
          try { document.close(); } catch (Exception ignored) {}
        }
      }
    }).start();
  }
}