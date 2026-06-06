class KbDocumentModel {
  final String documentId;
  final String fileName;
  final String mimeType;
  final String status; // "pending" | "processing" | "done" | "error"
  final int chunkCount;
  final DateTime? uploadedAt;

  const KbDocumentModel({
    required this.documentId,
    required this.fileName,
    required this.mimeType,
    required this.status,
    required this.chunkCount,
    this.uploadedAt,
  });

  bool get isReady => status == 'done';
  bool get isProcessing => status == 'processing' || status == 'pending';
  bool get isError => status == 'error';

  factory KbDocumentModel.fromJson(Map<String, dynamic> json) {
    return KbDocumentModel(
      documentId: json['documentId'] as String,
      fileName: json['fileName'] as String? ?? '',
      mimeType: json['mimeType'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      chunkCount: (json['chunkCount'] as num?)?.toInt() ?? 0,
      uploadedAt: json['uploadedAt'] != null
          ? DateTime.tryParse(json['uploadedAt'] as String)
          : null,
    );
  }

  KbDocumentModel copyWith({String? status, int? chunkCount}) {
    return KbDocumentModel(
      documentId: documentId,
      fileName: fileName,
      mimeType: mimeType,
      status: status ?? this.status,
      chunkCount: chunkCount ?? this.chunkCount,
      uploadedAt: uploadedAt,
    );
  }
}
